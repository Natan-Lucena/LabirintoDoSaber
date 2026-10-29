import { Uuid } from "@wave-telecom/framework/core";
import { Plan, PlanStatus, PlanType } from "../entities/plan";

export interface SearchPlanParams {
  educatorId: Uuid;
  studentId?: Uuid;
  status?: PlanStatus;
  type?: PlanType;
}

export interface PlanRepository {
  save(plan: Plan): Promise<void>;
  findById(id: Uuid): Promise<Plan | null>;
  search(params: SearchPlanParams): Promise<Plan[]>;
  findActivePdi(studentId: Uuid): Promise<Plan | null>;
}
