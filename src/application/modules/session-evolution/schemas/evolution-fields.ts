import { z } from "zod";
import { GoalStatus, MAX_PLAN_GOALS } from "../../../../domain/entities/plan";
import {
  CriterionResult,
  MAX_CRITERION_ATTEMPTS,
  MAX_EVOLUTION_CRITERIA,
} from "../../../../domain/entities/session-evolution";
import { uuidSchema } from "../../plan/schemas/plan-fields";

// successes ≤ attempts e successes sem attempts ficam com a entidade
// (400 INVALID_ATTEMPTS), não com o Zod.
export const criteriaSchema = z
  .array(
    z.object({
      goalId: uuidSchema.optional(),
      description: z.string().min(1).max(500),
      successCriterion: z.string().max(500).optional(),
      attempts: z.number().int().min(0).max(MAX_CRITERION_ATTEMPTS).optional(),
      successes: z.number().int().min(0).max(MAX_CRITERION_ATTEMPTS).optional(),
      result: z.nativeEnum(CriterionResult),
      note: z.string().max(500).optional(),
    })
  )
  .max(MAX_EVOLUTION_CRITERIA);

export const goalUpdatesSchema = z
  .array(
    z.object({
      goalId: uuidSchema,
      status: z.nativeEnum(GoalStatus),
    })
  )
  .max(MAX_PLAN_GOALS)
  .refine(
    (updates) => new Set(updates.map((u) => u.goalId)).size === updates.length,
    "Meta repetida em goalUpdates"
  );

export const descriptiveRecordSchema = z.string().trim().min(1).max(5000);
export const nextSessionSuggestionSchema = z.string().max(2000);
