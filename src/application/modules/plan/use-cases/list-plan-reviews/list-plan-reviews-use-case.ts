import { success, Uuid } from "@wave-telecom/framework/core";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { PlanReviewRepository } from "../../../../../domain/repositories/plan-review-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { loadOwnedPlan } from "../plan-access";

export interface ListPlanReviewsUseCaseRequest {
  educatorId: Uuid;
  planId: string;
}

export class ListPlanReviewsUseCase {
  constructor(
    private planRepository: PlanRepository,
    private planReviewRepository: PlanReviewRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: ListPlanReviewsUseCaseRequest) {
    const planResult = await loadOwnedPlan(
      this.planRepository,
      this.studentRepository,
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
