import { z } from "zod";
import { ApplicationStatus } from "../../../../domain/entities/scale-application";
import { uuidSchema } from "../../plan/schemas/plan-fields";

export const listScaleApplicationsSchema = z.object({
  studentId: uuidSchema.optional(),
  status: z.nativeEnum(ApplicationStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
