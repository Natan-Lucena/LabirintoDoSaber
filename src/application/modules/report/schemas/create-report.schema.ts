import { z } from "zod";
import {
  ReportAudience,
  ReportSection,
  ReportType,
} from "../../../../domain/entities/report";
import { dateOnlySchema, uuidSchema } from "../../plan/schemas/plan-fields";

export const createReportSchema = z.object({
  studentId: uuidSchema,
  type: z.nativeEnum(ReportType),
  audience: z.nativeEnum(ReportAudience),
  period: z.object({
    from: dateOnlySchema,
    to: dateOnlySchema,
  }),
  sections: z
    .array(z.nativeEnum(ReportSection))
    .min(1, "Escolha ao menos uma seção")
    .max(20),
});
