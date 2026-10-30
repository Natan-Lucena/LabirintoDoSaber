import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";

interface DeleteTaskNotebookUseCaseRequest {
  taskNotebookId: Uuid;
  educatorId: Uuid;
}

export class DeleteTaskNotebookUseCase {
  constructor(private taskNotebookRepository: TaskNotebookRepository) {}

  async execute(params: DeleteTaskNotebookUseCaseRequest) {
    try {
      const existingTaskNotebook = await this.taskNotebookRepository.getById(
        params.taskNotebookId
      );
      if (!existingTaskNotebook) {
        return failure("TASK_NOTEBOOK_NOT_FOUND");
      }

      if (existingTaskNotebook.educator.id.value !== params.educatorId.value) {
        return failure("NOT_NOTEBOOK_OWNER");
      }

      await this.taskNotebookRepository.delete(params.taskNotebookId);
      return success(null);
    } catch {
      return failure("DELETE_TASK_NOTEBOOK_FAILED");
    }
  }
}
