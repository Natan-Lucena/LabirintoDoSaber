import z from "zod";

export const startTaskSessionSchema = z.object({
  studentId: z.string().uuid(),
  name: z.string().max(100),
  taskNotebookId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
});
