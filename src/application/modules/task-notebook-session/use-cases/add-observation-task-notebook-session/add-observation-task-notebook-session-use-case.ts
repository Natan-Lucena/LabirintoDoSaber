import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";

export interface AddObservationTaskNotebookSessionUseCaseRequest {
  sessionId: string;
  observation: string;
}

export class AddObservationTaskNotebookSessionUseCase {
  constructor(private sessionRepository: TaskNotebookSessionRepository) {}

  async execute(request: AddObservationTaskNotebookSessionUseCaseRequest) {
    const sessionId = new Uuid(request.sessionId);

    const session = await this.sessionRepository.getById(sessionId);

    if (!session) {
      return failure("SESSION_NOT_FOUND");
    }

    const updated = session.addObservation(request.observation);

    if (!updated.ok) {
      return failure(updated.error);
    }

    await this.sessionRepository.save(updated.value);

    return success(updated.value);
  }
}
