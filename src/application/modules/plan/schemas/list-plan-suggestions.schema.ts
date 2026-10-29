import { z } from "zod";
import { SuggestionStatus } from "../../../../domain/entities/plan-suggestion";

export const listPlanSuggestionsSchema = z.object({
  status: z.nativeEnum(SuggestionStatus).optional(),
});
