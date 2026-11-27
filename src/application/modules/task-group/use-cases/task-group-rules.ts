import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Task } from "../../../../domain/entities/task";
import { TaskRepository } from "../../../../domain/repositories/task-repository";
import { findUnusableTask } from "../../task/use-cases/task-rules";

// AT-10: cadernos e grupos aceitam a biblioteca e os tipos novos, menos
// imprimível; e só tarefas que o educador pode usar (isUsableBy).
export async function checkPlayableTasks(
  taskRepository: TaskRepository,
  tasks: Task[],
  educatorId: Uuid
) {
  if (tasks.some((task) => task.isPrintable)) return failure("PRINTABLE_NOT_PLAYABLE" as const);
  if (await findUnusableTask(taskRepository, tasks, educatorId)) {
    return failure("UNAUTHORIZED" as const);
  }
  return success(void 0);
}

export async function checkGroupTasks(
  taskRepository: TaskRepository,
  taskIds: string[] | undefined,
  educatorId: Uuid
) {
  const ids = (taskIds ?? []).filter((id) => Uuid.isValid(id)).map((id) => new Uuid(id));
  if (ids.length === 0) return success(void 0);
  const tasks = await taskRepository.getByIds(ids);
  return checkPlayableTasks(taskRepository, tasks, educatorId);
}
