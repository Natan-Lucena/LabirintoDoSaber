import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";

export interface StartTaskNotebookSessionUseCaseRequest {
  studentId: string;
  name: string;
  educatorId: Uuid;
  taskNotebookId?: string;
  appointmentId?: string;
}

export class StartTaskNotebookSessionUseCase {
  constructor(
    private notebookRepository: TaskNotebookRepository,
    private sessionRepository: TaskNotebookSessionRepository,
    private studentAccess: StudentAccessService,
    private appointmentRepository: AppointmentRepository
  ) {}

  async execute(request: StartTaskNotebookSessionUseCaseRequest) {
    // Dono ou compartilhado (EQ-11); a sessão guarda quem conduziu (EQ-12).
    // Arquivado não recebe sessão nova (PA-04).
    const access = await this.studentAccess.assertActiveStudentAccess(
      new Uuid(request.studentId),
      request.educatorId
    );
    if (!access.ok) return access;
    const student = access.value;

    let taskNotebookId: Uuid | undefined;
    if (request.taskNotebookId) {
      const notebook = await this.notebookRepository.getById(
        new Uuid(request.taskNotebookId)
      );
      if (!notebook || notebook.educator.id.value !== request.educatorId.value) {
        return failure("NOTEBOOK_NOT_FOUND");
      }
      taskNotebookId = notebook.id;
    }

    let appointmentId: Uuid | undefined;
    if (request.appointmentId) {
      const appointment = await this.appointmentRepository.findById(
        new Uuid(request.appointmentId)
      );
      // O atendimento é dado clínico do aluno: vale o de qualquer educador
      // com acesso a ele, inclusive o do dono para o compartilhado.
      if (!appointment || appointment.studentId.value !== student.id.value) {
        return failure("APPOINTMENT_NOT_FOUND");
      }
      appointmentId = appointment.id;
    }

    const session = TaskNotebookSession.start(
      student.id,
      request.name,
      request.educatorId,
      taskNotebookId,
      appointmentId
    );

    if (!session.ok) {
      return failure("SESSION_CREATION_FAILED");
    }

    await this.sessionRepository.save(session.value);

    return success(session.value);
  }
}
