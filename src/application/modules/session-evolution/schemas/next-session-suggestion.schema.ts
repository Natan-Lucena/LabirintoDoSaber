import { z } from "zod";
import { uuidSchema } from "../../plan/schemas/plan-fields";
import { criteriaSchema } from "./evolution-fields";

export const nextSessionSuggestionSchema = z.object({
  sessionId: uuidSchema,
  criteria: criteriaSchema.optional(),
  descriptiveRecord: z.string().trim().max(5000).optional(),
});

export type NextSessionSuggestionBody = z.infer<typeof nextSessionSuggestionSchema>;
