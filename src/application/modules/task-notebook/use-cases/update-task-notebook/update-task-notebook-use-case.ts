import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskNotebookCategory } from "../../../../../domain/entities/task-notebook";

interface UpdateTaskNotebookUseCaseRequest {
  taskNotebookId: string;
  educatorId: Uuid;
  description?: string;
  category?: TaskNotebookCategory;
  taskGroupsIds?: string[];
}

export class UpdateTaskNotebookUseCase {
  constructor(private taskNotebookRepository: TaskNotebookRepository) {}

  async execute(props: UpdateTaskNotebookUseCaseRequest) {
    if (!Uuid.isValid(props.taskNotebookId)) {
      return failure("INVALID_TASK_NOTEBOOK_ID");
    }

    const existingNotebook = await this.taskNotebookRepository.getById(
      new Uuid(props.taskNotebookId)
    );

    if (!existingNotebook) {
      return failure("TASK_NOTEBOOK_NOT_FOUND");
    }

    if (existingNotebook.educator.id.value !== props.educatorId.value) {
      return failure("NOT_NOTEBOOK_OWNER");
    }

    const updateResult = existingNotebook.updateTaskNotebook({
      description: props.description,
      category: props.category,
      taskGroupsIds: props.taskGroupsIds,
    });

    if (!updateResult.ok) {
      return failure("INVALID_TASK_NOTEBOOK_DATA");
    }

    await this.taskNotebookRepository.save(updateResult.value);

    return success(void 0);
  }
}
