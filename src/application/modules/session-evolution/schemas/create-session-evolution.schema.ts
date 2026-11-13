import { z } from "zod";
import { uuidSchema } from "../../plan/schemas/plan-fields";
import {
  criteriaSchema,
  descriptiveRecordSchema,
  goalUpdatesSchema,
  nextSessionSuggestionSchema,
} from "./evolution-fields";

export const createSessionEvolutionSchema = z.object({
  sessionId: uuidSchema,
  planId: uuidSchema.optional(),
  criteria: criteriaSchema,
  descriptiveRecord: descriptiveRecordSchema,
  nextSessionSuggestion: nextSessionSuggestionSchema.optional(),
  goalUpdates: goalUpdatesSchema.optional(),
});
