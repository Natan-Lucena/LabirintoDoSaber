import { z } from "zod";
import { uuidSchema } from "../../plan/schemas/plan-fields";

export const listReportsSchema = z.object({
  studentId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
