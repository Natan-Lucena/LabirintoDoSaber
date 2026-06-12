import { Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository, SearchAppointmentParams } from "../../../../../domain/repositories/appointment-repository";
import { mapAppointmentToResponse } from "../../../../../infraestructure/mappers/map-appointment";

export interface ListAppointmentsUseCaseRequest {
  educatorId: Uuid;
  studentId?: Uuid;
  status?: string;
}

export class ListAppointmentsUseCase {
  constructor(private appointmentRepository: AppointmentRepository) {}

  async execute(request: ListAppointmentsUseCaseRequest) {
    const params: SearchAppointmentParams = {
      educatorId: request.educatorId,
      studentId: request.studentId,
    };

    const appointments = await this.appointmentRepository.search(params);
    return appointments.map(mapAppointmentToResponse);
  }
}
