import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";

interface DeleteTaskGroupUseCaseRequest {
  taskGroupId: string;
  educatorId: Uuid;
}

export class DeleteTaskGroupUseCase {
  constructor(private taskGroupRepository: TaskGroupRepository) {}

  async execute(params: DeleteTaskGroupUseCaseRequest) {
    if (!Uuid.isValid(params.taskGroupId)) return failure("TASK_GROUP_NOT_FOUND");
    const taskGroupId = new Uuid(params.taskGroupId);

    try {
      const existingTaskGroup = await this.taskGroupRepository.findById(taskGroupId);
      if (!existingTaskGroup) {
        return failure("TASK_GROUP_NOT_FOUND");
      }

      if (existingTaskGroup.educatorId.value !== params.educatorId.value) {
        return failure("NOT_GROUP_OWNER");
      }

      await this.taskGroupRepository.deleteById(taskGroupId);
      return success(null);
    } catch {
      return failure("DELETE_TASK_GROUP_FAILED");
    }
  }
}
