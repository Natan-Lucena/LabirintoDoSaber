import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentStatus } from "../../../../../domain/entities/appointment";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { findAppointmentConflict } from "../find-appointment-conflict";

export interface UpdateAppointmentUseCaseRequest {
  id: Uuid;
  educatorId: Uuid;
  scheduledAt?: Date;
  observation?: string | null;
  type?: string;
  durationMinutes?: number;
  status?: AppointmentStatus;
}

export class UpdateAppointmentUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private schedulerService: AppointmentSchedulerService
  ) {}

  async execute(request: UpdateAppointmentUseCaseRequest) {
    const appointment = await this.appointmentRepository.findById(request.id);

    if (!appointment || appointment.educatorId.value !== request.educatorId.value) {
      return failure("NOT_FOUND");
    }

    // Reativar (status PENDING) vem antes da edição, para permitir reativar e remarcar
    // na mesma requisição. Nos demais casos a edição vem antes de sair de PENDING.
    const statusFirst = request.status === AppointmentStatus.PENDING;
    let updated = appointment;

    if (request.status && statusFirst) {
      const statusResult = updated.changeStatus(request.status);
      if (!statusResult.ok) return statusResult;
      updated = statusResult.value;
    }

    const updateResult = updated.update({
      scheduledAt: request.scheduledAt,
      observation: request.observation,
      type: request.type,
      durationMinutes: request.durationMinutes,
    });
    if (!updateResult.ok) return updateResult;
    updated = updateResult.value;

    if (request.status && !statusFirst) {
      const statusResult = updated.changeStatus(request.status);
      if (!statusResult.ok) return statusResult;
      updated = statusResult.value;
    }

    const previousStatus = appointment.status;
    const rescheduled =
      updated.scheduledAt.getTime() !== appointment.scheduledAt.getTime() ||
      updated.durationMinutes !== appointment.durationMinutes;
    const reactivated =
      previousStatus === AppointmentStatus.CANCELLED && updated.status === AppointmentStatus.PENDING;

    if (updated.status === AppointmentStatus.PENDING && (rescheduled || reactivated)) {
      const conflict = await findAppointmentConflict(this.appointmentRepository, updated);
      if (conflict) {
        return failure({
          code: "APPOINTMENT_CONFLICT" as const,
          conflictingAppointmentId: conflict.id.value,
        });
      }
    }

    // Salvar antes de mexer na cadeia: o scheduleNext chamado por cancel busca o
    // próximo PENDING no banco e não pode reescolher este atendimento.
    await this.appointmentRepository.save(updated);

    if (previousStatus === AppointmentStatus.PENDING && updated.status !== AppointmentStatus.PENDING) {
      await this.schedulerService.cancel(updated);
    } else if (reactivated && updated.scheduledAt.getTime() > Date.now()) {
      await this.schedulerService.ensureScheduled(updated);
    }

    return success(updated);
  }
}
