import { success, Uuid } from "@wave-telecom/framework/core";
import { PlanStatus } from "../../../../../domain/entities/plan";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";
import { loadAccessiblePlan } from "../plan-access";

export interface ClosePlanUseCaseRequest {
  educatorId: Uuid;
  planId: string;
  status: PlanStatus.COMPLETED | PlanStatus.CANCELLED;
}

export class ClosePlanUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentAccess: StudentAccessService,
    private suggestionRepository: PlanSuggestionRepository
  ) {}

  async execute(request: ClosePlanUseCaseRequest) {
    const planResult = await loadAccessiblePlan(
      this.planRepository,
      this.studentAccess,
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
