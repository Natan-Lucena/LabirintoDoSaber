import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { PlanStatus } from "../../../../../domain/entities/plan";
import { sessionDurationMinutes } from "../../../../../domain/entities/session-evolution";
import { selectEvolutionPlan } from "../../../../../domain/services/evolution-plan-selector";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { loadOwnedSession } from "../evolution-access";

export interface GetEvolutionContextUseCaseRequest {
  educatorId: Uuid;
  sessionId: string;
}

export class GetEvolutionContextUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private studentRepository: StudentRepository,
    private planRepository: PlanRepository,
    private evolutionRepository: SessionEvolutionRepository
  ) {}

  async execute(request: GetEvolutionContextUseCaseRequest) {
    const access = await loadOwnedSession(
      this.sessionRepository,
      this.studentRepository,
      request.sessionId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { session, student } = access.value;

    if (!session.finishedAt) return failure("SESSION_NOT_FINISHED");

    const plans = await this.planRepository.search({
      educatorId: request.educatorId,
      studentId: session.studentId,
      status: PlanStatus.ACTIVE,
    });
    const selection = selectEvolutionPlan({ session, plans });
    const existing = await this.evolutionRepository.findBySessionId(session.id);

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
    });
  }
}
