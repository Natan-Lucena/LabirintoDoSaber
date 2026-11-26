import { success, Uuid } from "@wave-telecom/framework/core";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { PlanReviewRepository } from "../../../../../domain/repositories/plan-review-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessiblePlan } from "../plan-access";

export interface ListPlanReviewsUseCaseRequest {
  educatorId: Uuid;
  planId: string;
}

export class ListPlanReviewsUseCase {
  constructor(
    private planRepository: PlanRepository,
    private planReviewRepository: PlanReviewRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: ListPlanReviewsUseCaseRequest) {
    const planResult = await loadAccessiblePlan(
      this.planRepository,
      this.studentAccess,
      request.planId,
      request.educatorId
    );
    if (!planResult.ok) return planResult;

    const reviews = await this.planReviewRepository.listByPlanId(
      planResult.value.id
    );

    return success(reviews);
  }
}
