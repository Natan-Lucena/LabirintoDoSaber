import { success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleAppointment } from "../appointment-access";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";

export interface DeleteAppointmentUseCaseRequest {
  id: Uuid;
  educatorId: Uuid;
}

export class DeleteAppointmentUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private schedulerService: AppointmentSchedulerService,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: DeleteAppointmentUseCaseRequest) {
    const loaded = await loadAccessibleAppointment(
      this.appointmentRepository,
      this.studentAccess,
      request.id,
      request.educatorId
    );
    if (!loaded.ok) return loaded;
    const appointment = loaded.value;

    // Tirar de PENDING antes de mexer na cadeia: senão o scheduleNext chamado por
    // cancel reescolheria este mesmo atendimento como próximo líder.
    const cancelled = appointment.cancel();
    await this.appointmentRepository.save(cancelled);
    await this.schedulerService.cancel(cancelled);
    await this.appointmentRepository.delete(request.id);

    return success(undefined);
  }
}
