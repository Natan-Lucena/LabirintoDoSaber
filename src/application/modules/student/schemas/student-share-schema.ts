import z from "zod";

export const shareStudentSchema = z.object({
  educatorId: z.string().trim().min(1),
});
