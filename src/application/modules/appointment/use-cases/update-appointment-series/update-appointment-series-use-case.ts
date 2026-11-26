import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Appointment, AppointmentStatus } from "../../../../../domain/entities/appointment";
import {
  SeriesResult,
  SkippedOccurrence,
} from "../../../../../domain/entities/appointment-series";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSeriesRepository } from "../../../../../domain/repositories/appointment-series-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import {
  atTimeInSaoPaulo,
  dateInSaoPaulo,
  timeInSaoPaulo,
} from "../../../../../domain/utils/date-only";
import { findAppointmentConflicts } from "../find-appointment-conflict";
import { loadAccessibleSeries, loadOccurrencesFrom } from "../series-access";

export interface UpdateAppointmentSeriesUseCaseRequest {
  educatorId: Uuid;
  seriesId: string;
  fromAppointmentId: string;
  // Só a hora local de São Paulo é usada; cada ocorrência mantém o seu dia.
  scheduledAt?: Date;
  durationMinutes?: number;
  type?: string;
  observation?: string | null;
}

// RC-05: "este e os seguintes". Muda a ocorrência indicada e as seguintes
// PENDING que ainda vão acontecer; passadas, concluídas e canceladas ficam
// como estão. A série guarda a regra de criação e não muda.
export class UpdateAppointmentSeriesUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private seriesRepository: AppointmentSeriesRepository,
    private schedulerService: AppointmentSchedulerService,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: UpdateAppointmentSeriesUseCaseRequest) {
    const loaded = await loadAccessibleSeries(
      this.seriesRepository,
      this.studentAccess,
      request.seriesId,
      request.educatorId
    );
    if (!loaded.ok) return loaded;
    const series = loaded.value;

    const occurrences = await loadOccurrencesFrom(
      this.appointmentRepository,
      series.id,
      request.fromAppointmentId
    );
    if (!occurrences.ok) return occurrences;

    const now = new Date();
    const isEditable = (appointment: Appointment) =>
      appointment.status === AppointmentStatus.PENDING && appointment.scheduledAt > now;

    const [from] = occurrences.value;
    if (!isEditable(from)) return failure("APPOINTMENT_NOT_EDITABLE");

    const time = request.scheduledAt ? timeInSaoPaulo(request.scheduledAt) : undefined;

    const changes: { before: Appointment; after: Appointment }[] = [];
    for (const before of occurrences.value.filter(isEditable)) {
      const updated = before.update({
        scheduledAt: time ? atTimeInSaoPaulo(dateInSaoPaulo(before.scheduledAt), time) : undefined,
        durationMinutes: request.durationMinutes,
        type: request.type,
        observation: request.observation,
      });
      // Toda ocorrência aqui é PENDING, então a edição sempre é aceita.
      if (!updated.ok) return updated;
      changes.push({ before, after: updated.value });
    }

    // A indicada não pode ir para um horário que já passou (hoje às 18:00
    // remarcada para as 08:00 quando já são 10:00).
    if (changes[0].after.scheduledAt <= now) return failure("APPOINTMENT_NOT_EDITABLE");

    const rescheduled = (change: { before: Appointment; after: Appointment }) =>
      change.after.scheduledAt.getTime() !== change.before.scheduledAt.getTime() ||
      change.after.durationMinutes !== change.before.durationMinutes;

    // Só horário e duração podem criar conflito; a ocorrência em conflito
    // fica como estava e vai para skipped.
    const conflicts = await findAppointmentConflicts(
      this.appointmentRepository,
      changes.filter(rescheduled).map((change) => change.after)
    );

    const applied: typeof changes = [];
    const skipped: SkippedOccurrence[] = [];
    for (const change of changes) {
      const conflict = conflicts.get(change.after.id.value);
      if (conflict) {
        skipped.push({
          appointmentId: change.after.id.value,
          scheduledAt: change.after.scheduledAt,
          reason: "CONFLICT",
          conflictingAppointmentId: conflict.id.value,
        });
      } else {
        applied.push(change);
      }
    }

    for (const change of applied) {
      await this.appointmentRepository.save(change.after);
    }

    // Cadeia de lembretes, depois de salvar. O líder é o PENDING futuro mais
    // próximo, então, se for desta série, é a primeira ocorrência remarcada;
    // as demais ficam semanas depois e não mudam de dia. Basta remarcar a
    // primeira.
    const firstMoved = applied.find(
      (change) => change.after.scheduledAt.getTime() !== change.before.scheduledAt.getTime()
    );
    if (firstMoved) {
      await this.schedulerService.reschedule(firstMoved.after);
    }

    return success<SeriesResult>({
      series,
      created: applied.map((change) => change.after),
      skipped,
    });
  }
}
