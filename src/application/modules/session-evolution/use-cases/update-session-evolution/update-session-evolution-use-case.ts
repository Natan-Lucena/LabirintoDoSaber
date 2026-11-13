import { success, Uuid } from "@wave-telecom/framework/core";
import { Plan } from "../../../../../domain/entities/plan";
import {
  EvolutionCriterionInput,
  EvolutionGoalUpdate,
} from "../../../../../domain/entities/session-evolution";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { applyGoalChanges, loadOwnedEvolution } from "../evolution-access";

export interface UpdateSessionEvolutionUseCaseRequest {
  educatorId: Uuid;
  evolutionId: string;
  criteria?: EvolutionCriterionInput[];
  descriptiveRecord?: string;
  nextSessionSuggestion?: string;
  goalUpdates?: EvolutionGoalUpdate[];
}

export class UpdateSessionEvolutionUseCase {
  constructor(
    private evolutionRepository: SessionEvolutionRepository,
    private studentRepository: StudentRepository,
    private planRepository: PlanRepository,
    private sessionRepository: TaskNotebookSessionRepository
  ) {}

  async execute(request: UpdateSessionEvolutionUseCaseRequest) {
    const access = await loadOwnedEvolution(
      this.evolutionRepository,
      this.studentRepository,
      request.evolutionId,
      request.educatorId
    );
    if (!access.ok) return access;
    const evolution = access.value;

    // A edição usa o plano gravado na evolução, mesmo que já encerrado.
    const plan = evolution.planId
      ? (await this.planRepository.findById(evolution.planId)) ?? undefined
      : undefined;

    const updateResult = evolution.update(
      {
        criteria: request.criteria,
        descriptiveRecord: request.descriptiveRecord,
        nextSessionSuggestion: request.nextSessionSuggestion,
        goalUpdates: request.goalUpdates,
      },
      plan
    );
    if (!updateResult.ok) return updateResult;
    const updated = updateResult.value;

    let changedPlan: Plan | undefined;
    if (plan && request.goalUpdates) {
      const planResult = applyGoalChanges(plan, request.goalUpdates);
      if (!planResult.ok) return planResult;
      changedPlan = planResult.value;
    }

    const session =
      request.descriptiveRecord !== undefined
        ? await this.sessionRepository.getById(evolution.sessionId)
        : null;

    // Tudo validado em memória; grava em sequência, sem transação (EV-07).
    if (changedPlan) await this.planRepository.save(changedPlan);
    await this.evolutionRepository.save(updated);
    if (session) {
      await this.sessionRepository.save(
        session.withObservation(updated.descriptiveRecord)
      );
    }

    return success(updated);
  }
}
