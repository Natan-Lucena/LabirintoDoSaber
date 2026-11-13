import { z } from "zod";
import {
  criteriaSchema,
  descriptiveRecordSchema,
  goalUpdatesSchema,
  nextSessionSuggestionSchema,
} from "./evolution-fields";

export const updateSessionEvolutionSchema = z.object({
  criteria: criteriaSchema.optional(),
  descriptiveRecord: descriptiveRecordSchema.optional(),
  nextSessionSuggestion: nextSessionSuggestionSchema.optional(),
  goalUpdates: goalUpdatesSchema.optional(),
});
