import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskCategory, TaskType } from "../../../../../domain/entities/task";
import { normalizeText } from "../../../../../domain/utils/text";

export interface ListTasksUseCaseRequest {
  educatorId: Uuid;
  id?: Uuid;
  category?: TaskCategory;
  type?: TaskType;
  promptContains?: string;
}

// AT-11: só as tarefas do educador (sem a biblioteca), com os campos novos.
export class ListTasksUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(params: ListTasksUseCaseRequest) {
    try {
      const tasks = await this.taskRepository.listByEducator(params.educatorId);
      const search = params.promptContains ? normalizeText(params.promptContains) : undefined;

      return success(
        tasks.filter(
          (task) =>
            (!params.id || task.id.value === params.id.value) &&
            (!params.category || task.category === params.category) &&
            (!params.type || task.type === params.type) &&
            (!search || normalizeText(task.prompt).includes(search))
        )
      );
    } catch {
      return failure("LIST_TASKS_FAILED");
    }
  }
}
