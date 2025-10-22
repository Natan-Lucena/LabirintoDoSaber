import z from "zod";

export const assignStudentSchema = z.object({
  studentId: z.string().uuid(),
  newEducatorEmail: z.string().email(),
});
