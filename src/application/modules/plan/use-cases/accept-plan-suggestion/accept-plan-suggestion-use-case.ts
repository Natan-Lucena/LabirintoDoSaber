import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { GoalStatus, Plan } from "../../../../../domain/entities/plan";
import {
  PlanSuggestion,
  SuggestionKind,
} from "../../../../../domain/entities/plan-suggestion";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";
import { loadOwnedPlan, loadPendingSuggestion } from "../plan-access";

export interface AcceptPlanSuggestionUseCaseRequest {
  educatorId: Uuid;
  suggestionId: string;
}

export class AcceptPlanSuggestionUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentRepository: StudentRepository,
    private suggestionRepository: PlanSuggestionRepository
  ) {}

  async execute(request: AcceptPlanSuggestionUseCaseRequest) {
    const loaded = await loadPendingSuggestion(
      this.suggestionRepository,
      request.suggestionId,
      request.educatorId
    );
    if (!loaded.ok) return failure(loaded.error);
    const suggestion = loaded.value;

    const planResult = await loadOwnedPlan(
      this.planRepository,
      this.studentRepository,
      suggestion.planId.value,
      request.educatorId
    );
    if (!planResult.ok) return failure(planResult.error);

    // Plano encerrado, meta removida, limite de metas ou data fora da
    // vigência: a sugestão não serve mais e é descartada.
    const applied = this.apply(planResult.value, suggestion);
    if (!applied.ok) {
      const dismissed = suggestion.dismiss();
      if (dismissed.ok) await this.suggestionRepository.save(dismissed.value);
      return failure("SUGGESTION_NOT_APPLICABLE");
    }

    const accepted = suggestion.accept();
    if (!accepted.ok) return failure(accepted.error);

    // Em sequência e sem transação: primeiro o plano, depois a sugestão.
    await this.planRepository.save(applied.value);
    await this.suggestionRepository.save(accepted.value);

    return success(applied.value);
  }

  private apply(plan: Plan, suggestion: PlanSuggestion) {
    const change = suggestion.proposedChange;
    const goalId = suggestion.goalId?.value ?? "";

    switch (suggestion.kind) {
      case SuggestionKind.UPDATE_GOAL_STATUS:
        return plan.changeGoalStatus(goalId, change.status as GoalStatus);
      case SuggestionKind.ADD_GOAL:
        return plan.addGoal({
          description: change.description as string,
          successCriterion: change.successCriterion,
        });
      case SuggestionKind.REWRITE_GOAL:
        // A edição pela lista completa não acusa meta ausente; confere aqui.
        if (!plan.goals.some((goal) => goal.id.value === goalId)) {
          return failure("GOAL_NOT_FOUND");
        }
        return plan.update({
          goals: plan.goals.map((goal) =>
            goal.id.value === goalId
              ? {
                  id: goal.id.value,
                  description: change.description as string,
                  successCriterion: change.successCriterion ?? goal.successCriterion,
                }
              : {
                  id: goal.id.value,
                  description: goal.description,
                  successCriterion: goal.successCriterion,
                }
          ),
        });
      case SuggestionKind.SCHEDULE_REVIEW:
        return plan.update({ nextReviewDate: change.nextReviewDate });
    }
  }
}
