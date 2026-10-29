import { z } from "zod";
import { MAX_PLAN_GOALS, PlanSource, PlanType } from "../../../../domain/entities/plan";
import { dateOnlySchema, uuidSchema } from "./plan-fields";

export const createPlanSchema = z.object({
  studentId: uuidSchema,
  type: z.nativeEnum(PlanType),
  title: z.string().min(1).max(120),
  generalObjective: z.string().min(1).max(2000),
  professionalNotes: z.string().max(2000).optional(),
  focus: z.string().max(1000).optional(),
  consideredDifficulties: z.array(z.string().min(1).max(100)).max(20).optional(),
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional(),
  nextReviewDate: dateOnlySchema.optional(),
  parentPlanId: uuidSchema.optional(),
  sessionDate: dateOnlySchema.optional(),
  appointmentId: uuidSchema.optional(),
  source: z.nativeEnum(PlanSource),
  goals: z
    .array(
      z.object({
        description: z.string().min(1).max(500),
        successCriterion: z.string().max(500).optional(),
      })
    )
    .max(MAX_PLAN_GOALS),
});
