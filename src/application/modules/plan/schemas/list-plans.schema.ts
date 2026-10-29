import { z } from "zod";
import { PlanStatus, PlanType } from "../../../../domain/entities/plan";
import { uuidSchema } from "./plan-fields";

export const listPlansSchema = z.object({
  studentId: uuidSchema.optional(),
  status: z.nativeEnum(PlanStatus).optional(),
  type: z.nativeEnum(PlanType).optional(),
});
