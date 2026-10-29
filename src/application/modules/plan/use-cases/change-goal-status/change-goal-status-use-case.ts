import { success, Uuid } from "@wave-telecom/framework/core";
import { GoalStatus } from "../../../../../domain/entities/plan";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { loadOwnedPlan } from "../plan-access";

export interface ChangeGoalStatusUseCaseRequest {
  educatorId: Uuid;
  planId: string;
  goalId: string;
  status: GoalStatus;
}

export class ChangeGoalStatusUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: ChangeGoalStatusUseCaseRequest) {
    const planResult = await loadOwnedPlan(
      this.planRepository,
      this.studentRepository,
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
