import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Appointment } from "../../../../../domain/entities/appointment";
import {
  AppointmentSeries,
  RecurrenceFrequency,
  SeriesResult,
  SkippedOccurrence,
} from "../../../../../domain/entities/appointment-series";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSeriesRepository } from "../../../../../domain/repositories/appointment-series-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { findAppointmentConflicts } from "../find-appointment-conflict";

export interface CreateAppointmentSeriesUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
  scheduledAt: Date;
  frequency: RecurrenceFrequency;
  occurrences: number;
  type?: string;
  durationMinutes?: number;
  observation?: string;
}

export class CreateAppointmentSeriesUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private seriesRepository: AppointmentSeriesRepository,
    private schedulerService: AppointmentSchedulerService,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: CreateAppointmentSeriesUseCaseRequest) {
    // Dono ou compartilhado (EQ-11); a série entra na agenda de quem a cria.
    // Arquivado não recebe série (RC-08).
    const access = await this.studentAccess.assertActiveStudentAccess(
      new Uuid(request.studentId),
      request.educatorId
    );
    if (!access.ok) return access;

    const seriesResult = AppointmentSeries.create({
      studentId: access.value.id,
      educatorId: request.educatorId,
      frequency: request.frequency,
      firstScheduledAt: request.scheduledAt,
      occurrences: request.occurrences,
      type: request.type,
      durationMinutes: request.durationMinutes,
      observation: request.observation,
    });
    if (!seriesResult.ok) return seriesResult;
    const series = seriesResult.value;

    // RC-01: cada ocorrência é um atendimento comum com seriesId.
    const occurrences = series.occurrenceDates().map((scheduledAt) =>
      Appointment.create({
        educatorId: series.educatorId,
        studentId: series.studentId,
        seriesId: series.id,
        scheduledAt,
        type: series.type,
        durationMinutes: series.durationMinutes,
        observation: series.observation,
      })
    );

    // RC-03: a ocorrência em conflito é pulada; se todas conflitarem, nada é criado.
    const conflicts = await findAppointmentConflicts(this.appointmentRepository, occurrences);
    const created: Appointment[] = [];
    const skipped: SkippedOccurrence[] = [];

    for (const occurrence of occurrences) {
      const conflict = conflicts.get(occurrence.id.value);
      if (conflict) {
        skipped.push({
          scheduledAt: occurrence.scheduledAt,
          reason: "CONFLICT",
          conflictingAppointmentId: conflict.id.value,
        });
      } else {
        created.push(occurrence);
      }
    }

    if (created.length === 0) {
      return failure({
        code: "APPOINTMENT_CONFLICT" as const,
        conflictingAppointmentId: skipped[0].conflictingAppointmentId,
      });
    }

    await this.seriesRepository.save(series);
    for (const appointment of created) {
      await this.appointmentRepository.save(appointment);
    }

    // RC-07: a cadeia de lembretes guarda só o próximo atendimento; basta
    // oferecer a primeira ocorrência que ainda vai acontecer.
    const now = new Date();
    const firstUpcoming = created.find((appointment) => appointment.scheduledAt > now);
    if (firstUpcoming) {
      await this.schedulerService.ensureScheduled(firstUpcoming);
    }

    return success<SeriesResult>({ series, created, skipped });
  }
}
