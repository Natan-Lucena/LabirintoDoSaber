import { Uuid } from "@wave-telecom/framework/core";
import { Plan, PlanStatus, PlanType } from "../entities/plan";

export interface SearchPlanParams {
  // Alunos que o educador acessa (dono ou compartilhado); o autor gravado no
  // plano não entra (EQ-11).
  studentIds: Uuid[];
  status?: PlanStatus;
  type?: PlanType;
}

export interface PlanRepository {
  save(plan: Plan): Promise<void>;
  findById(id: Uuid): Promise<Plan | null>;
  search(params: SearchPlanParams): Promise<Plan[]>;
  findActivePdi(studentId: Uuid): Promise<Plan | null>;
  // Planos ACTIVE de todos os educadores com nextReviewDate ≤ `date`
  // (AAAA-MM-DD), inclusive as vencidas (cron de notificações), ordenados por
  // nextReviewDate e depois id.
  listActiveWithReviewDueBy(date: string): Promise<Plan[]>;
}
