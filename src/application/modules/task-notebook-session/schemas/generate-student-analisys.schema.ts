import z from "zod";

export const generateStudentAnalisysSchema = z.object({
  // Id inválido vira 404 STUDENT_NOT_FOUND no use case.
  studentId: z.string().min(1),
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
