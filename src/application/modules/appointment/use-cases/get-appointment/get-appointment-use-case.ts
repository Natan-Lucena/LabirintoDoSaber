import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { mapAppointmentToResponse } from "../../../../../infraestructure/mappers/map-appointment";

export interface GetAppointmentUseCaseRequest {
  id: Uuid;
  educatorId: Uuid;
}

export class GetAppointmentUseCase {
  constructor(private appointmentRepository: AppointmentRepository) {}

  async execute(request: GetAppointmentUseCaseRequest) {
    const appointment = await this.appointmentRepository.findById(request.id);

    if (!appointment || appointment.educatorId.value !== request.educatorId.value) {
      return failure("NOT_FOUND");
    }

    return success(mapAppointmentToResponse(appointment));
  }
}
