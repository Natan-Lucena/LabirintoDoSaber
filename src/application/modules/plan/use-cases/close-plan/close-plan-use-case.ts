import { success, Uuid } from "@wave-telecom/framework/core";
import { PlanStatus } from "../../../../../domain/entities/plan";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";
import { loadOwnedPlan } from "../plan-access";

export interface ClosePlanUseCaseRequest {
  educatorId: Uuid;
  planId: string;
  status: PlanStatus.COMPLETED | PlanStatus.CANCELLED;
}

export class ClosePlanUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentRepository: StudentRepository,
    private suggestionRepository: PlanSuggestionRepository
  ) {}

  async execute(request: ClosePlanUseCaseRequest) {
    const planResult = await loadOwnedPlan(
      this.planRepository,
      this.studentRepository,
      request.planId,
      request.educatorId
    );
    if (!planResult.ok) return planResult;

    const closed = planResult.value.close(request.status);
    if (!closed.ok) return closed;

    await this.planRepository.save(closed.value);
    await this.suggestionRepository.dismissPendingByPlanId(closed.value.id);

    return success(closed.value);
  }
}
