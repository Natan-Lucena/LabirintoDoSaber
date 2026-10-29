import { z } from "zod";
import { dateOnlySchema } from "./plan-fields";

export const createPlanReviewSchema = z.object({
  note: z.string().min(1).max(2000),
  nextReviewDate: dateOnlySchema.optional(),
});
