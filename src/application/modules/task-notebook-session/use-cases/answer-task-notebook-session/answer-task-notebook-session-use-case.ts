import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { isMultipleChoiceType } from "../../../../../domain/entities/task";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { TaskAnswer } from "../../../../../domain/entities/task-notebook-session";
import { assertTaskInSessionNotebook } from "../session-task-access";

export interface AnswerTaskNotebookSessionUseCaseRequest {
  sessionId: string;
  taskId: string;
  selectedAlternativeId: string;
  timeToAnswer: number; // em milissegundos
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

    // AT-10: imprimível não é jogado na sessão.
    if (task.isPrintable) {
      return failure("PRINTABLE_NOT_PLAYABLE");
    }

    // Tipos jogáveis novos têm a rota própria de resultado (RS-03).
    if (!isMultipleChoiceType(task.type)) {
      return failure("USE_ACTIVITY_RESULT_ROUTE");
    }

    const inNotebook = await assertTaskInSessionNotebook(
      this.notebookRepository,
      this.taskGroupRepository,
      session,
      task.id
    );
    if (!inNotebook.ok) return inNotebook;

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
}
