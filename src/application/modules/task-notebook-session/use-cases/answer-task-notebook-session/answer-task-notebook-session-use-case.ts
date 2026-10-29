import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskNotebook } from "../../../../../domain/entities/task-notebook";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { TaskAnswer } from "../../../../../domain/entities/task-notebook-session";

export interface AnswerTaskNotebookSessionUseCaseRequest {
  sessionId: string;
  taskId: string;
  selectedAlternativeId: string;
  timeToAnswer: number; // em segundos
}

export class AnswerTaskNotebookSessionUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private taskRepository: TaskRepository,
    private notebookRepository: TaskNotebookRepository,
    private taskGroupRepository: TaskGroupRepository
  ) {}

  async execute(request: AnswerTaskNotebookSessionUseCaseRequest) {
    const sessionId = new Uuid(request.sessionId);
    const taskId = new Uuid(request.taskId);
    const alternativeId = new Uuid(request.selectedAlternativeId);

    const [session, task] = await Promise.all([
      this.sessionRepository.getById(sessionId),
      this.taskRepository.getById(taskId),
    ]);

    if (!session) {
      return failure("SESSION_NOT_FOUND");
    }

    if (session.finishedAt) {
      return failure("SESSION_ALREADY_FINISHED");
    }

    if (!task) {
      return failure("TASK_NOT_FOUND");
    }

    if (session.taskNotebookId) {
      const notebook = await this.notebookRepository.getById(
        session.taskNotebookId
      );

      if (!notebook) {
        return failure("NOTEBOOK_NOT_FOUND");
      }

      if (!(await this.isTaskInNotebook(task.id, notebook))) {
        return failure("TASK_NOT_IN_NOTEBOOK");
      }
    }

    const alreadyAnswered = session.answers.some(
      (a) => a.taskId.value === task.id.value
    );

    if (alreadyAnswered) {
      return failure("TASK_ALREADY_ANSWERED");
    }

    const correctAlt = task.alternatives.find((a) => a.isCorrect);

    const isCorrect = correctAlt?.id?.value === alternativeId.value;

    const answer: TaskAnswer = {
      taskId: task.id,
      selectedAlternativeId: alternativeId,
      isCorrect,
      timeToAnswer: request.timeToAnswer,
      answeredAt: new Date(),
    };

    const updated = session.answerTask(answer);

    if (!updated.ok) {
      return failure("ANSWER_CREATION_FAILED");
    }

    await this.sessionRepository.save(updated.value);

    return success(updated.value);
  }

  private async isTaskInNotebook(taskId: Uuid, notebook: TaskNotebook) {
    if (notebook.tasks.some((t) => t.id.value === taskId.value)) {
      return true;
    }

    if (notebook.taskGroupsIds.length === 0) {
      return false;
    }

    const groups = await this.taskGroupRepository.findByIds(
      notebook.taskGroupsIds.map((id) => new Uuid(id))
    );

    return groups.some((g) => g.tasksIds.includes(taskId.value));
  }
}
