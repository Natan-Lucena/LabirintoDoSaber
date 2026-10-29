import { z } from "zod";
import { PlanStatus } from "../../../../domain/entities/plan";

export const closePlanSchema = z.object({
  status: z.enum([PlanStatus.COMPLETED, PlanStatus.CANCELLED]),
});
