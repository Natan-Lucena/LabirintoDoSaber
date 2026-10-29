import { Uuid } from "@wave-telecom/framework/core";
import { PlanSuggestion, SuggestionStatus } from "../entities/plan-suggestion";

export interface PlanSuggestionRepository {
  save(suggestion: PlanSuggestion): Promise<void>;
  findById(id: Uuid): Promise<PlanSuggestion | null>;
  // Ordenado por createdAt desc.
  listByEducatorId(educatorId: Uuid, status?: SuggestionStatus): Promise<PlanSuggestion[]>;
  countPendingByPlanId(planId: Uuid): Promise<number>;
  dismissPendingByPlanId(planId: Uuid): Promise<void>;
}
