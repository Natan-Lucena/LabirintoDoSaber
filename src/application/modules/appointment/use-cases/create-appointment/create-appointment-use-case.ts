import { success, Uuid } from "@wave-telecom/framework/core";
import { Appointment } from "../../../../../domain/entities/appointment";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";

export interface CreateAppointmentUseCaseRequest {
  educatorId: Uuid;
  studentId: Uuid;
  scheduledAt: Date;
  observation?: string;
}

export class CreateAppointmentUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private schedulerService: AppointmentSchedulerService
  ) {}

  async execute(request: CreateAppointmentUseCaseRequest) {
    const appointment = Appointment.create({
      educatorId: request.educatorId,
      studentId: request.studentId,
      scheduledAt: request.scheduledAt,
      observation: request.observation,
    });

    await this.appointmentRepository.save(appointment);
    await this.schedulerService.ensureScheduled(appointment);

    return success(appointment);
  }
}
