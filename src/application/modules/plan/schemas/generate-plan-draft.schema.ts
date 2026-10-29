import { z } from "zod";
import { PlanType } from "../../../../domain/entities/plan";
import { dateOnlySchema, uuidSchema } from "./plan-fields";

export const generatePlanDraftSchema = z
  .object({
    studentId: uuidSchema,
    type: z.nativeEnum(PlanType),
    focus: z.string().min(1).max(1000),
    consideredDifficulties: z.array(z.string().min(1).max(100)).min(1).max(20),
    durationMonths: z.union([z.literal(3), z.literal(6)]).optional(),
    parentPlanId: uuidSchema.optional(),
    sessionDate: dateOnlySchema.optional(),
    includeAnamnesisTemplateId: uuidSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === PlanType.PDI && data.durationMonths === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationMonths"],
        message: "durationMonths é obrigatório no PDI",
      });
    }

    if (data.type === PlanType.PE && !data.sessionDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionDate"],
        message: "sessionDate é obrigatório no PE",
      });
    }
  });
