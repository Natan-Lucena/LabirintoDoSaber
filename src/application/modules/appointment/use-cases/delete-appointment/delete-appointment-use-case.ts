import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";

export interface DeleteAppointmentUseCaseRequest {
  id: Uuid;
  educatorId: Uuid;
}

export class DeleteAppointmentUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private schedulerService: AppointmentSchedulerService
  ) {}

  async execute(request: DeleteAppointmentUseCaseRequest) {
    const appointment = await this.appointmentRepository.findById(request.id);

    if (!appointment || appointment.educatorId.value !== request.educatorId.value) {
      return failure("NOT_FOUND");
    }

    await this.schedulerService.cancel(appointment);
    await this.appointmentRepository.delete(request.id);

    return success(undefined);
  }
}
