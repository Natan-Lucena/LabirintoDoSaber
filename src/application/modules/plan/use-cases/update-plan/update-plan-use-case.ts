import { success, Uuid } from "@wave-telecom/framework/core";
import { UpdatePlanProps } from "../../../../../domain/entities/plan";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessiblePlan } from "../plan-access";

export interface UpdatePlanUseCaseRequest extends UpdatePlanProps {
  educatorId: Uuid;
  planId: string;
}

export class UpdatePlanUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute({ educatorId, planId, ...changes }: UpdatePlanUseCaseRequest) {
    const planResult = await loadAccessiblePlan(
      this.planRepository,
      this.studentAccess,
      planId,
      educatorId
    );
    if (!planResult.ok) return planResult;

    const updated = planResult.value.update(changes);
    if (!updated.ok) return updated;

    await this.planRepository.save(updated.value);

    return success(updated.value);
  }
}
