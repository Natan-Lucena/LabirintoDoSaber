import { Uuid } from "@wave-telecom/framework/core";
import { TaskRepository } from "../../../../domain/repositories/task-repository";

// AT-10: grupos aceitam tarefas da biblioteca e dos tipos novos, menos imprimível.
export async function hasPrintableTask(taskRepository: TaskRepository, taskIds?: string[]) {
  const ids = (taskIds ?? []).filter((id) => Uuid.isValid(id)).map((id) => new Uuid(id));
  if (ids.length === 0) return false;
  const tasks = await taskRepository.getByIds(ids);
  return tasks.some((task) => task.isPrintable);
}
