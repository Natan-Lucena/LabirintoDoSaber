import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
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
    private notebookRepository: TaskNotebookRepository
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
