import { Uuid } from "@wave-telecom/framework/core";
import { PlanReview } from "../entities/plan-review";

export interface PlanReviewRepository {
  save(review: PlanReview): Promise<void>;
  listByPlanId(planId: Uuid): Promise<PlanReview[]>;
}
