import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { Task } from "../../../../../domain/entities/task";

export interface GeneratorReportTaskNotebookSessionUseCaseRequest {
  sessionId: string;
}

export class GeneratorReportTaskNotebookSessionUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private taskRepository: TaskRepository
  ) {}

  async execute(request: GeneratorReportTaskNotebookSessionUseCaseRequest) {
    const sessionId = new Uuid(request.sessionId);

    const session = await this.sessionRepository.getById(sessionId);

    if (!session) {
      return failure("SESSION_NOT_FOUND");
    }

    const uniqueTaskIds = new Map<string, Uuid>();
    for (const answer of session.answers) {
      uniqueTaskIds.set(answer.taskId.value, answer.taskId);
    }

    const tasks = uniqueTaskIds.size
      ? await this.taskRepository.getByIds(Array.from(uniqueTaskIds.values()))
      : [];
    const tasksById: Record<string, Task | null> = {};
    for (const task of tasks) {
      tasksById[task.id.value] = task;
    }

    const totalTimeSession =
      (session.finishedAt?.getTime()! - session.startedAt.getTime()) / 1000; // segundos

    const totalQuestions = session.answers.length;

    const averageTimePerQuestion =
      session.answers.reduce((acc, curr) => acc + curr.timeToAnswer, 0) /
      totalQuestions; // segundos

    const correctTimes = session.answers
      .filter((a) => a.isCorrect)
      .map((a) => a.timeToAnswer);

    const incorrectTimes = session.answers
      .filter((a) => !a.isCorrect)
      .map((a) => a.timeToAnswer);

    const averageCorrectTime =
      correctTimes.length > 0
        ? correctTimes.reduce((acc, n) => acc + n, 0) / correctTimes.length
        : null; // segundos

    const averageIncorrectTime =
      incorrectTimes.length > 0
        ? incorrectTimes.reduce((acc, n) => acc + n, 0) / incorrectTimes.length
        : null; // segundos

    const statsByCategory: Record<
      string,
      { total: number; correct: number; percentage: number | null }
    > = {};

    const statsByType: Record<
      string,
      { total: number; correct: number; percentage: number | null }
    > = {};

    for (const answer of session.answers) {
      const task = tasksById[answer.taskId.value];
      if (!task) continue;

      const category = task.category;
      const type = task.type;

      if (!statsByCategory[category]) {
        statsByCategory[category] = { total: 0, correct: 0, percentage: null };
      }
      statsByCategory[category].total++;
      if (answer.isCorrect) {
        statsByCategory[category].correct++;
      }

      if (!statsByType[type]) {
        statsByType[type] = { total: 0, correct: 0, percentage: null };
      }
      statsByType[type].total++;
      if (answer.isCorrect) {
        statsByType[type].correct++;
      }
    }

    const percentageByCategory: Record<string, number | null> = {};

    for (const category in statsByCategory) {
      const { total, correct } = statsByCategory[category];
      percentageByCategory[category] =
        total > 0 ? (correct / total) * 100 : null; // porcentagem
    }

    const percentageByType: Record<string, number | null> = {};

    for (const type in statsByType) {
      const { total, correct } = statsByType[type];
      percentageByType[type] = total > 0 ? (correct / total) * 100 : null; // porcentagem
    }

    return success({
      sessionName: session.name,
      totalTimeSession,
      totalQuestions,
      averageTimePerQuestion,
      averageCorrectTime,
      averageIncorrectTime,
      percentageByCategory,
      percentageByType,
      observation: session.observation ?? null,
    });
  }
}
