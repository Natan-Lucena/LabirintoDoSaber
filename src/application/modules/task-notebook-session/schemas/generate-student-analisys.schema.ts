import z from "zod";

export const generateStudentAnalisysSchema = z.object({
  studentId: z.string().uuid(),
});

export const generateStudentAnalisysQuerySchema = z
  .object({
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().positive().optional(),
  })
  .refine(
    (data) => !data.limit || (!data.startDate && !data.endDate),
    {
      message: "Não é possível combinar 'limit' com 'startDate' ou 'endDate'",
      path: ["limit"],
    }
  );
