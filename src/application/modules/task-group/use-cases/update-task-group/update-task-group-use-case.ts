import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { TaskCategory } from "../../../../../domain/entities/task";

interface UpdateTaskGroupUseCaseRequest {
  id: string;
  educatorId: Uuid;
  name?: string;
  tasksIds?: string[];
  category?: TaskCategory;
}

export class UpdateTaskGroupUseCase {
  constructor(private taskGroupRepository: TaskGroupRepository) {}

  async execute(props: UpdateTaskGroupUseCaseRequest) {
    try {
      if (!props.id || !Uuid.isValid(props.id)) {
        return failure("INVALID_TASK_GROUP_ID");
      }

      const existingTaskGroup = await this.taskGroupRepository.findById(
        new Uuid(props.id)
      );

      if (!existingTaskGroup) {
        return failure("TASK_GROUP_NOT_FOUND");
      }

      if (existingTaskGroup.educatorId.value !== props.educatorId.value) {
        return failure("NOT_GROUP_OWNER");
      }

      const updatedTaskGroupResult = existingTaskGroup.updateTaskGroup({
        name: props.name,
        tasksIds: props.tasksIds,
        category: props.category,
      });

      if (!updatedTaskGroupResult.ok) {
        return failure("INVALID_TASK_GROUP_DATA");
      }

      await this.taskGroupRepository.save(updatedTaskGroupResult.value);

      return success(void 0);
    } catch {
      return failure("UPDATE_TASK_GROUP_FAILED");
    }
  }
}
