import { z } from "zod";
import { MAX_PLAN_GOALS } from "../../../../domain/entities/plan";
import { dateOnlySchema, uuidSchema } from "./plan-fields";

export const updatePlanSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  generalObjective: z.string().min(1).max(2000).optional(),
  // PP-05: null apaga; ausente mantém.
  professionalNotes: z.string().max(2000).nullable().optional(),
  endDate: dateOnlySchema.optional(),
  nextReviewDate: dateOnlySchema.nullable().optional(),
  goals: z
    .array(
      z.object({
        id: uuidSchema.optional(),
        description: z.string().min(1).max(500),
        successCriterion: z.string().max(500).optional(),
      })
    )
    .max(MAX_PLAN_GOALS)
    .optional(),
});
