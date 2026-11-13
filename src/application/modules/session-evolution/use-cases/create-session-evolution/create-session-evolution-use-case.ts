import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Plan } from "../../../../../domain/entities/plan";
import {
  EvolutionCriterionInput,
  EvolutionGoalUpdate,
  SessionEvolution,
} from "../../../../../domain/entities/session-evolution";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import {
  SessionEvolutionAlreadyExistsError,
  SessionEvolutionRepository,
} from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { applyGoalChanges, loadOwnedSession } from "../evolution-access";

export interface CreateSessionEvolutionUseCaseRequest {
  educatorId: Uuid;
  sessionId: string;
  planId?: string;
  criteria: EvolutionCriterionInput[];
  descriptiveRecord: string;
  nextSessionSuggestion?: string;
  goalUpdates?: EvolutionGoalUpdate[];
}

const alreadyExists = (evolutionId?: string) =>
  failure({ code: "EVOLUTION_ALREADY_EXISTS" as const, evolutionId });

export class CreateSessionEvolutionUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private studentRepository: StudentRepository,
    private planRepository: PlanRepository,
    private evolutionRepository: SessionEvolutionRepository
  ) {}

  async execute(request: CreateSessionEvolutionUseCaseRequest) {
    const access = await loadOwnedSession(
      this.sessionRepository,
      this.studentRepository,
      request.sessionId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { session } = access.value;

    if (!session.finishedAt) return failure("SESSION_NOT_FINISHED");

    const existing = await this.evolutionRepository.findBySessionId(session.id);
    if (existing) return alreadyExists(existing.id.value);

    const goalUpdates = request.goalUpdates ?? [];
    let plan: Plan | undefined;

    if (request.planId) {
      const found = Uuid.isValid(request.planId)
        ? await this.planRepository.findById(new Uuid(request.planId))
        : null;
      if (
        !found ||
        found.studentId.value !== session.studentId.value ||
        found.educatorId.value !== request.educatorId.value
      ) {
        return failure("INVALID_PLAN");
      }
      // Plano encerrado: com goalUpdates a evolução inteira falha com 409
      // (BE-EV-03); sem eles, o plano só não serve de origem (EV-05).
      if (!found.isEditable) {
        return failure(goalUpdates.length > 0 ? "PLAN_NOT_EDITABLE" : "INVALID_PLAN");
      }
      plan = found;
    }

    const evolutionResult = SessionEvolution.create({
      session,
      educatorId: request.educatorId,
      plan,
      criteria: request.criteria,
      descriptiveRecord: request.descriptiveRecord,
      nextSessionSuggestion: request.nextSessionSuggestion,
      goalUpdates,
    });
    if (!evolutionResult.ok) return evolutionResult;
    const evolution = evolutionResult.value;

    const planResult = plan ? applyGoalChanges(plan, goalUpdates) : success(undefined);
    if (!planResult.ok) return planResult;

    // Tudo validado em memória; grava em sequência, sem transação (EV-07).
    if (planResult.value) await this.planRepository.save(planResult.value);
    try {
      await this.evolutionRepository.save(evolution);
    } catch (error) {
      // Criação em paralelo: a outra requisição gravou primeiro.
      if (!(error instanceof SessionEvolutionAlreadyExistsError)) throw error;
      const winner = await this.evolutionRepository.findBySessionId(session.id);
      return alreadyExists(winner?.id.value);
    }
    await this.sessionRepository.save(
      session.withObservation(request.descriptiveRecord)
    );

    return success(evolution);
  }
}
