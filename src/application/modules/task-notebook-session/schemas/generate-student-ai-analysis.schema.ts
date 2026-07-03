import z from "zod";

export const generateStudentAiAnalysisQuerySchema = z
  .object({
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().positive().optional(),
    templateId: z.string().uuid().optional(),
  })
  .refine((data) => !data.limit || (!data.startDate && !data.endDate), {
    message: "Não é possível combinar 'limit' com 'startDate' ou 'endDate'",
    path: ["limit"],
  });
