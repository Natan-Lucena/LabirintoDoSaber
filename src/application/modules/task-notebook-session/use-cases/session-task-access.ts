import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSession } from "../../../../domain/entities/task-notebook-session";
import { TaskGroupRepository } from "../../../../domain/repositories/task-group-repository";
import { TaskNotebookRepository } from "../../../../domain/repositories/task-notebook-repository";

// Sessão com caderno: a atividade precisa estar nele ou num dos grupos dele.
// Sessão sem caderno aceita qualquer atividade. Usado pela resposta e pelo
// resultado de jogo (RS-02).
export async function assertTaskInSessionNotebook(
  notebookRepository: TaskNotebookRepository,
  taskGroupRepository: TaskGroupRepository,
  session: TaskNotebookSession,
  taskId: Uuid
) {
  if (!session.taskNotebookId) return success(undefined);

  const notebook = await notebookRepository.getById(session.taskNotebookId);
  if (!notebook) return failure("NOTEBOOK_NOT_FOUND");

  if (notebook.tasks.some((task) => task.id.value === taskId.value)) {
    return success(undefined);
  }

  if (notebook.taskGroupsIds.length > 0) {
    const groups = await taskGroupRepository.findByIds(
      notebook.taskGroupsIds.map((id) => new Uuid(id))
    );
    if (groups.some((group) => group.tasksIds.includes(taskId.value))) {
      return success(undefined);
    }
  }

  return failure("TASK_NOT_IN_NOTEBOOK");
}
