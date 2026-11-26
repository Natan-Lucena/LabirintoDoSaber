import { success, Uuid } from "@wave-telecom/framework/core";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { loadEditableTask } from "../task-rules";

interface DeleteTaskUseCaseRequest {
  taskId: string;
  educatorId: Uuid;
}

export class DeleteTaskUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(params: DeleteTaskUseCaseRequest) {
    const task = await loadEditableTask(this.taskRepository, params.taskId, params.educatorId);
    if (!task.ok) return task;

    await this.taskRepository.delete(task.value.id);
    return success(null);
  }
}
