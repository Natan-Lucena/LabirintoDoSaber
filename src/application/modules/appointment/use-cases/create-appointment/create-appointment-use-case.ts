import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Appointment } from "../../../../../domain/entities/appointment";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { findAppointmentConflict } from "../find-appointment-conflict";

export interface CreateAppointmentUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
  scheduledAt: Date;
  observation?: string;
  type?: string;
  durationMinutes?: number;
}

export class CreateAppointmentUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private schedulerService: AppointmentSchedulerService
  ) {}

  async execute(request: CreateAppointmentUseCaseRequest) {
    const appointment = Appointment.create({
      educatorId: request.educatorId,
      studentId: new Uuid(request.studentId),
      scheduledAt: request.scheduledAt,
      observation: request.observation,
      type: request.type,
      durationMinutes: request.durationMinutes,
    });

    const conflict = await findAppointmentConflict(this.appointmentRepository, appointment);
    if (conflict) {
      return failure({
        code: "APPOINTMENT_CONFLICT" as const,
        conflictingAppointmentId: conflict.id.value,
      });
    }

    await this.appointmentRepository.save(appointment);
    await this.schedulerService.ensureScheduled(appointment);

    return success(appointment);
  }
}
