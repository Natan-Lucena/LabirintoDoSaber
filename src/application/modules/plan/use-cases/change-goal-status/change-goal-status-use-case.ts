import { success, Uuid } from "@wave-telecom/framework/core";
import { GoalStatus } from "../../../../../domain/entities/plan";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessiblePlan } from "../plan-access";

export interface ChangeGoalStatusUseCaseRequest {
  educatorId: Uuid;
  planId: string;
  goalId: string;
  status: GoalStatus;
}

export class ChangeGoalStatusUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: ChangeGoalStatusUseCaseRequest) {
    const planResult = await loadAccessiblePlan(
      this.planRepository,
      this.studentAccess,
      request.planId,
      request.educatorId
    );
    if (!planResult.ok) return planResult;

    const updated = planResult.value.changeGoalStatus(
      request.goalId,
      request.status
    );
    if (!updated.ok) return updated;

    await this.planRepository.save(updated.value);

    return success(updated.value);
  }
}
