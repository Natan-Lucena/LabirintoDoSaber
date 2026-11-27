import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { Task } from "../../../../../domain/entities/task";
import { timeToAnswerInMs } from "../../../../../domain/entities/task-notebook-session";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { ActivityResultRepository } from "../../../../../domain/repositories/activity-result-repository";
import { summarizeActivityResults } from "../../../../../domain/entities/activity-result";
import { mapActivityResultToResponse } from "../../../../../infraestructure/mappers/map-activity-result";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleSession } from "../../../session-evolution/use-cases/evolution-access";
import { loadAuthorNames } from "../../../../services/author-names";

export interface GeneratorReportTaskNotebookSessionUseCaseRequest {
  sessionId: string;
  educatorId: Uuid;
}

export class GeneratorReportTaskNotebookSessionUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private studentAccess: StudentAccessService,
    private taskRepository: TaskRepository,
    private evolutionRepository: SessionEvolutionRepository,
    private activityResultRepository: ActivityResultRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: GeneratorReportTaskNotebookSessionUseCaseRequest) {
    // RS-08: só quem acessa o aluno (dono ou compartilhado) lê o relatório.
    const access = await loadAccessibleSession(
      this.sessionRepository,
      this.studentAccess,
      request.sessionId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { session } = access.value;

    const evolution = await this.evolutionRepository.findBySessionId(session.id);
    // RS-05: os resultados de jogo ficam fora das estatísticas abaixo, que
    // usam só as respostas de múltipla escolha.
    const activityResults = await this.activityResultRepository.listBySessionId(session.id);

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

    // Sessão sem respostas (por exemplo, só jogos): null, nunca NaN.
    // Tempos em milissegundos, com as respostas antigas normalizadas (PP-08).
    const averageTimePerQuestion =
      totalQuestions > 0
        ? session.answers.reduce((acc, curr) => acc + timeToAnswerInMs(curr), 0) /
          totalQuestions
        : null;

    const correctTimes = session.answers
      .filter((a) => a.isCorrect)
      .map(timeToAnswerInMs);

    const incorrectTimes = session.answers
      .filter((a) => !a.isCorrect)
      .map(timeToAnswerInMs);

    const averageCorrectTime =
      correctTimes.length > 0
        ? correctTimes.reduce((acc, n) => acc + n, 0) / correctTimes.length
        : null; // milissegundos

    const averageIncorrectTime =
      incorrectTimes.length > 0
        ? incorrectTimes.reduce((acc, n) => acc + n, 0) / incorrectTimes.length
        : null; // milissegundos

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

    // EQ-12: quem conduziu, quando não é quem lê.
    const authorNames = await loadAuthorNames(
      this.educatorRepository,
      [session.educatorId],
      request.educatorId
    );

    return success({
      sessionName: session.name,
      authorName: authorNames.get(session.educatorId.value),
      totalTimeSession,
      totalQuestions,
      averageTimePerQuestion,
      averageCorrectTime,
      averageIncorrectTime,
      percentageByCategory,
      percentageByType,
      observation: session.observation ?? null,
      evolutionId: evolution?.id.value,
      activitySummary: summarizeActivityResults(activityResults),
      activityResults: activityResults.map(mapActivityResultToResponse),
    });
  }
}
