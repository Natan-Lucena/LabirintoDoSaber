import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleSession } from "../../../session-evolution/use-cases/evolution-access";

export interface AddObservationTaskNotebookSessionUseCaseRequest {
  sessionId: string;
  educatorId: Uuid;
  observation: string;
}

export class AddObservationTaskNotebookSessionUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: AddObservationTaskNotebookSessionUseCaseRequest) {
    // RS-08: só quem acessa o aluno (dono ou compartilhado) registra.
    const access = await loadAccessibleSession(
      this.sessionRepository,
      this.studentAccess,
      request.sessionId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { session } = access.value;

    const updated = session.addObservation(request.observation);

    if (!updated.ok) {
      return failure(updated.error);
    }

    await this.sessionRepository.save(updated.value);

    return success(updated.value);
  }
}
