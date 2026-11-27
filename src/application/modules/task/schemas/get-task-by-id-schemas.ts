import z from "zod";

// Id inválido vira 404 TASK_NOT_FOUND no use case.
export const getTaskByIdSchema = z.object({
  id: z.string().min(1),
});
