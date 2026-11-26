import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { loadTask } from "../task-rules";

interface GetTaskByIdUseCaseRequest {
  taskId: string;
}

// Leitura aberta a todo educador: a biblioteca é de todos, e cadernos e sessões
// leem as tarefas que usam.
export class GetTaskByIdUseCase {
  constructor(private taskRepository: TaskRepository) {}

  async execute(params: GetTaskByIdUseCaseRequest) {
    return loadTask(this.taskRepository, params.taskId);
  }
}
