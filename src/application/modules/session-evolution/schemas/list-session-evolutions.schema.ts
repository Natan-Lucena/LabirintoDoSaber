import { z } from "zod";
import { dateOnlySchema, uuidSchema } from "../../plan/schemas/plan-fields";

export const listSessionEvolutionsSchema = z
  .object({
    studentId: uuidSchema.optional(),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "from deve ser anterior ou igual a to",
    path: ["from"],
  });
