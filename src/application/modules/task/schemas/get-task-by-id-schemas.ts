import z from "zod";

export const getTaskByIdSchema = z.object({
  id: z.string().uuid(),
});
