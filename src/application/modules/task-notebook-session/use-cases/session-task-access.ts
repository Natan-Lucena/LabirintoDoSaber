import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Task } from "../../../../domain/entities/task";
import { TaskNotebookSession } from "../../../../domain/entities/task-notebook-session";
import { TaskGroupRepository } from "../../../../domain/repositories/task-group-repository";
import { TaskNotebookRepository } from "../../../../domain/repositories/task-notebook-repository";
import { TaskRepository } from "../../../../domain/repositories/task-repository";
import { findUnusableTask } from "../../task/use-cases/task-rules";

// Atividade que pode ser jogada/respondida na sessão. Usado pela resposta e
// pelo resultado de jogo.
// - Sessão com caderno: a atividade precisa estar nele ou num dos grupos dele
//   (RS-02).
// - Sessão sem caderno: só atividade que o educador pode usar (isUsableBy).
export async function assertTaskAllowedInSession(
  repositories: {
    notebookRepository: TaskNotebookRepository;
    taskGroupRepository: TaskGroupRepository;
    taskRepository: TaskRepository;
  },
  session: TaskNotebookSession,
  task: Task,
  educatorId: Uuid
) {
  const { notebookRepository, taskGroupRepository, taskRepository } = repositories;

  if (!session.taskNotebookId) {
    if (await findUnusableTask(taskRepository, [task], educatorId)) {
      return failure("UNAUTHORIZED");
    }
    return success(undefined);
  }

  const notebook = await notebookRepository.getById(session.taskNotebookId);
  if (!notebook) return failure("NOTEBOOK_NOT_FOUND");

  if (notebook.tasks.some((item) => item.id.value === task.id.value)) {
    return success(undefined);
  }

  if (notebook.taskGroupsIds.length > 0) {
    const groups = await taskGroupRepository.findByIds(
      notebook.taskGroupsIds.map((id) => new Uuid(id))
    );
    if (groups.some((group) => group.tasksIds.includes(task.id.value))) {
      return success(undefined);
    }
  }

  return failure("TASK_NOT_IN_NOTEBOOK");
}
