import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import {
  endOfDayInSaoPaulo,
  startOfDayInSaoPaulo,
} from "../../../../../domain/utils/date-only";
import { mapAppointmentToResponse } from "../../../../../infraestructure/mappers/map-appointment";

export interface ListAppointmentsUseCaseRequest {
  educatorId: Uuid;
  studentId?: Uuid;
  // AAAA-MM-DD, dias inteiros em São Paulo; os dois são inclusivos.
  from?: string;
  to?: string;
}

export class ListAppointmentsUseCase {
  constructor(private appointmentRepository: AppointmentRepository) {}

  async execute(request: ListAppointmentsUseCaseRequest) {
    if (request.from && request.to && request.from > request.to) {
      return failure("INVALID_PERIOD");
    }

    const appointments = await this.appointmentRepository.search({
      educatorId: request.educatorId,
      studentId: request.studentId,
      scheduledAfter: request.from ? startOfDayInSaoPaulo(request.from) : undefined,
      scheduledBefore: request.to ? endOfDayInSaoPaulo(request.to) : undefined,
    });

    return success(appointments.map(mapAppointmentToResponse));
  }
}
