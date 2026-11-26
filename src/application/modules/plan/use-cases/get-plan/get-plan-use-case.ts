import { success, Uuid } from "@wave-telecom/framework/core";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAuthorNames } from "../../../../services/author-names";
import { loadAccessiblePlan } from "../plan-access";

export interface GetPlanUseCaseRequest {
  educatorId: Uuid;
  planId: string;
}

export class GetPlanUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentAccess: StudentAccessService,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: GetPlanUseCaseRequest) {
    const planResult = await loadAccessiblePlan(
      this.planRepository,
      this.studentAccess,
      request.planId,
      request.educatorId
    );
    if (!planResult.ok) return planResult;
    const plan = planResult.value;

    // EQ-12: autor só quando não é quem lê.
    const authorNames = await loadAuthorNames(
      this.educatorRepository,
      [plan.educatorId],
      request.educatorId
    );

    return success({ plan, authorName: authorNames.get(plan.educatorId.value) });
  }
}
