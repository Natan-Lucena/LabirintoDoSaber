import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { mapAppointmentToResponse } from "../../../../../infraestructure/mappers/map-appointment";

export interface UpdateAppointmentUseCaseRequest {
  id: Uuid;
  educatorId: Uuid;
  scheduledAt?: Date;
  observation?: string | null;
}

export class UpdateAppointmentUseCase {
  constructor(private appointmentRepository: AppointmentRepository) {}

  async execute(request: UpdateAppointmentUseCaseRequest) {
    const appointment = await this.appointmentRepository.findById(request.id);

    if (!appointment || appointment.educatorId.value !== request.educatorId.value) {
      return failure("NOT_FOUND");
    }

    const updated = appointment.update({
      scheduledAt: request.scheduledAt,
      observation: request.observation,
    });

    await this.appointmentRepository.save(updated);

    return success(updated);
  }
}
