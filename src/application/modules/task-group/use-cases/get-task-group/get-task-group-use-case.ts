import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";

interface GetTaskGroupUseCaseRequest {
  taskGroupId: string;
  educatorId: Uuid;
}

export class GetTaskGroupUseCase {
  constructor(
    private taskGroupRepository: TaskGroupRepository,
    private taskNotebookRepository: TaskNotebookRepository
  ) {}

  async execute(request: GetTaskGroupUseCaseRequest) {
    if (!Uuid.isValid(request.taskGroupId)) {
      return failure("TASK_GROUP_NOT_FOUND");
    }

    const taskGroup = await this.taskGroupRepository.findById(
      new Uuid(request.taskGroupId)
    );
    if (!taskGroup) {
      return failure("TASK_GROUP_NOT_FOUND");
    }

    if (taskGroup.educatorId.value === request.educatorId.value) {
      return success(taskGroup);
    }

    const notebooks = await this.taskNotebookRepository.search({
      educatorId: request.educatorId,
    });
    const inOwnNotebook = notebooks.some((notebook) =>
      notebook.taskGroupsIds.includes(taskGroup.id.value)
    );
    if (!inOwnNotebook) {
      return failure("UNAUTHORIZED");
    }

    return success(taskGroup);
  }
}
