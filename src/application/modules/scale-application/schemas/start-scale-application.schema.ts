import { z } from "zod";
import { uuidSchema } from "../../plan/schemas/plan-fields";

export const startScaleApplicationSchema = z.object({
  studentId: uuidSchema,
  templateId: uuidSchema,
  appointmentId: uuidSchema.optional(),
});
