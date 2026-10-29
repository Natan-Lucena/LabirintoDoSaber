import { Uuid } from "@wave-telecom/framework/core";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { loadOwnedPlan } from "../plan-access";

export interface GetPlanUseCaseRequest {
  educatorId: Uuid;
  planId: string;
}

export class GetPlanUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: GetPlanUseCaseRequest) {
    return loadOwnedPlan(
      this.planRepository,
      this.studentRepository,
      request.planId,
      request.educatorId
    );
  }
}
