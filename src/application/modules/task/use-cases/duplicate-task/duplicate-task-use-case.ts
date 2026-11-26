import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { loadTask } from "../task-rules";

interface DuplicateTaskUseCaseRequest {
  taskId: string;
  educatorId: Uuid;
}

// AT-07: cópia EDUCATOR editável do educador do token. Duplica a biblioteca, as
// próprias e as antigas sem dono; de outro educador, 403.
export class DuplicateTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(params: DuplicateTaskUseCaseRequest) {
    const task = await loadTask(this.taskRepository, params.taskId);
    if (!task.ok) return task;

    if (task.value.belongsToAnotherEducator(params.educatorId)) {
      return failure("UNAUTHORIZED" as const);
    }

    const copy = task.value.duplicateFor(params.educatorId);
    await this.taskRepository.save(copy);

    return success(copy);
  }
}
