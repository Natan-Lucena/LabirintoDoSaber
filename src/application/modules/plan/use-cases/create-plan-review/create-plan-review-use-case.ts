import { success, Uuid } from "@wave-telecom/framework/core";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { PlanReviewRepository } from "../../../../../domain/repositories/plan-review-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessiblePlan } from "../plan-access";

export interface CreatePlanReviewUseCaseRequest {
  educatorId: Uuid;
  planId: string;
  note: string;
  nextReviewDate?: string;
}

export class CreatePlanReviewUseCase {
  constructor(
    private planRepository: PlanRepository,
    private planReviewRepository: PlanReviewRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: CreatePlanReviewUseCaseRequest) {
    const planResult = await loadAccessiblePlan(
      this.planRepository,
      this.studentAccess,
      request.planId,
      request.educatorId
    );
    if (!planResult.ok) return planResult;

    const reviewed = planResult.value.review(request.note, request.nextReviewDate);
    if (!reviewed.ok) return reviewed;

    await this.planRepository.save(reviewed.value.plan);
    await this.planReviewRepository.save(reviewed.value.review);

    return success(reviewed.value.review);
  }
}
