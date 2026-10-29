import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
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
    private studentRepository: StudentRepository,
    private appointmentRepository: AppointmentRepository
  ) {}

  async execute(request: StartTaskNotebookSessionUseCaseRequest) {
    const student = await this.studentRepository.getById(
      new Uuid(request.studentId)
    );

    if (!student) {
      return failure("STUDENT_NOT_FOUND");
    }

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
      if (
        !appointment ||
        appointment.educatorId.value !== request.educatorId.value ||
        appointment.studentId.value !== student.id.value
      ) {
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
