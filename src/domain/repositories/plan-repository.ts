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
  // Planos ACTIVE dos alunos que o overview usa, sem varrer todos: os PDIs,
  // os com nextReviewDate ≤ `reviewDueBy` (AAAA-MM-DD) e o PE mais recente
  // (sessionDate, depois createdAt) de cada aluno. Sem repetição.
  listForOverview(studentIds: Uuid[], reviewDueBy: string): Promise<Plan[]>;
}
