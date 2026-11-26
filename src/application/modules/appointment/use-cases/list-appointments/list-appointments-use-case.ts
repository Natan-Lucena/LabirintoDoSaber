import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
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
  constructor(
    private appointmentRepository: AppointmentRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: ListAppointmentsUseCaseRequest) {
    if (request.from && request.to && request.from > request.to) {
      return failure("INVALID_PERIOD");
    }

    // Sem aluno: a agenda do educador. Com aluno: os atendimentos dele de
    // qualquer educador, para quem acessa o aluno (EQ-11).
    if (request.studentId) {
      const access = await this.studentAccess.assertStudentAccess(
        request.studentId,
        request.educatorId
      );
      if (!access.ok) return access;
    }

    const appointments = await this.appointmentRepository.search({
      educatorId: request.studentId ? undefined : request.educatorId,
      studentId: request.studentId,
      scheduledAfter: request.from ? startOfDayInSaoPaulo(request.from) : undefined,
      scheduledBefore: request.to ? endOfDayInSaoPaulo(request.to) : undefined,
    });

    return success(appointments.map(mapAppointmentToResponse));
  }
}
