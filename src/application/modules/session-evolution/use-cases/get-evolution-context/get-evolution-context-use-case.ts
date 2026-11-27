import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { PlanStatus } from "../../../../../domain/entities/plan";
import { sessionDurationMinutes } from "../../../../../domain/entities/session-evolution";
import { selectEvolutionPlan } from "../../../../../domain/services/evolution-plan-selector";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { ActivityResultRepository } from "../../../../../domain/repositories/activity-result-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { loadAccessibleSession } from "../evolution-access";

export interface GetEvolutionContextUseCaseRequest {
  educatorId: Uuid;
  sessionId: string;
}

export class GetEvolutionContextUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private studentAccess: StudentAccessService,
    private planRepository: PlanRepository,
    private evolutionRepository: SessionEvolutionRepository,
    private activityResultRepository: ActivityResultRepository,
    private taskRepository: TaskRepository
  ) {}

  async execute(request: GetEvolutionContextUseCaseRequest) {
    const access = await loadAccessibleSession(
      this.sessionRepository,
      this.studentAccess,
      request.sessionId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { session, student } = access.value;

    if (!session.finishedAt) return failure("SESSION_NOT_FINISHED");

    const plans = await this.planRepository.search({
      studentIds: [session.studentId],
      status: PlanStatus.ACTIVE,
    });
    const selection = selectEvolutionPlan({ session, plans });
    const existing = await this.evolutionRepository.findBySessionId(session.id);
    const activityResults = await this.loadActivityResults(session.id);

    return success({
      session: {
        id: session.id.value,
        studentId: session.studentId.value,
        studentName: student.name,
        name: session.name,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        durationMinutes: sessionDurationMinutes(session.startedAt, session.finishedAt),
        appointmentId: session.appointmentId?.value,
        answeredCount: session.answers.length,
        correctCount: session.answers.filter((answer) => answer.isCorrect).length,
      },
      plan: selection
        ? {
            id: selection.plan.id.value,
            type: selection.plan.type,
            title: selection.plan.title,
          }
        : undefined,
      suggestedCriteria: selection?.suggestedCriteria ?? [],
      existingEvolutionId: existing?.id.value,
      activityResults,
    });
  }

  // RS-06: resultados de jogo com o título da atividade (TaskSummary.title).
  // Atividade excluída fica sem título.
  private async loadActivityResults(sessionId: Uuid) {
    const results = await this.activityResultRepository.listBySessionId(sessionId);
    if (results.length === 0) return [];

    const tasks = await this.taskRepository.getByIds(results.map((result) => result.taskId));
    const titleById = new Map(tasks.map((task) => [task.id.value, task.title]));

    return results.map((result) => ({
      taskId: result.taskId.value,
      title: titleById.get(result.taskId.value),
      taskType: result.taskType,
      completed: result.completed,
      correct: result.correct,
      attempts: result.attempts,
      errors: result.errors,
    }));
  }
}
