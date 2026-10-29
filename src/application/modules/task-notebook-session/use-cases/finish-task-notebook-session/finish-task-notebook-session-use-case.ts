import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { AppointmentStatus } from "../../../../../domain/entities/appointment";

export interface FinishTaskNotebookSessionUseCaseRequest {
  sessionId: string;
}

export class FinishTaskNotebookSessionUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private appointmentRepository: AppointmentRepository,
    private schedulerService: AppointmentSchedulerService
  ) {}

  async execute(request: FinishTaskNotebookSessionUseCaseRequest) {
    const sessionId = new Uuid(request.sessionId);

    const session = await this.sessionRepository.getById(sessionId);

    if (!session) {
      return failure("SESSION_NOT_FOUND");
    }

    if (session.finishedAt) {
      return failure("SESSION_ALREADY_FINISHED");
    }

    const updated = session.finish();

    if (!updated.ok) {
      return failure("SESSION_FINISH_FAILED");
    }

    await this.sessionRepository.save(updated.value);

    if (updated.value.appointmentId) {
      await this.completeAppointment(updated.value.appointmentId);
    }

    return success(updated.value);
  }

  // Concluir o atendimento é um efeito colateral: se falhar, a sessão já está finalizada
  // e o finish não deve falhar por isso.
  private async completeAppointment(appointmentId: Uuid) {
    try {
      const appointment = await this.appointmentRepository.findById(appointmentId);
      if (!appointment || appointment.status !== AppointmentStatus.PENDING) {
        return;
      }

      const completed = appointment.changeStatus(AppointmentStatus.COMPLETED);
      if (!completed.ok) return;

      // Salvar antes de mexer na cadeia: o scheduleNext chamado por cancel busca o
      // próximo PENDING no banco e não pode reescolher este atendimento.
      await this.appointmentRepository.save(completed.value);
      await this.schedulerService.cancel(completed.value);
    } catch (error) {
      console.error("[finish-task-notebook-session] failed to complete appointment", {
        appointmentId: appointmentId.value,
        error: error instanceof Error ? error.name : "unknown",
      });
    }
  }
}
