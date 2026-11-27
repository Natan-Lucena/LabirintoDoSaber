import { success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleAppointment } from "../appointment-access";
import { mapAppointmentToResponse } from "../../../../../infraestructure/mappers/map-appointment";

export interface GetAppointmentUseCaseRequest {
  id: Uuid;
  educatorId: Uuid;
}

export class GetAppointmentUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: GetAppointmentUseCaseRequest) {
    const loaded = await loadAccessibleAppointment(
      this.appointmentRepository,
      this.studentAccess,
      request.id,
      request.educatorId
    );
    if (!loaded.ok) return loaded;
    const appointment = loaded.value;

    return success(mapAppointmentToResponse(appointment));
  }
}
