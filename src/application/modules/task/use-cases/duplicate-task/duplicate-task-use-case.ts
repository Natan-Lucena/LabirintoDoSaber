import { success, Uuid } from "@wave-telecom/framework/core";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { loadUsableTask } from "../task-rules";

interface DuplicateTaskUseCaseRequest {
  taskId: string;
  educatorId: Uuid;
}

// AT-07: cópia EDUCATOR editável do educador do token. Duplica o que ele pode
// usar (isUsableBy): biblioteca, as próprias e as antigas dele ou avulsas.
export class DuplicateTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(params: DuplicateTaskUseCaseRequest) {
    const task = await loadUsableTask(this.taskRepository, params.taskId, params.educatorId);
    if (!task.ok) return task;

    const copy = task.value.duplicateFor(params.educatorId);
    await this.taskRepository.save(copy);

    return success(copy);
  }
}
