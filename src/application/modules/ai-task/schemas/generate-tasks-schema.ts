import z from "zod";
import { TaskCategory } from "../../../../domain/entities/task";

export const generateTasksSchema = z.object({
  targetAudience: z.string().min(1),
  instructions: z.string().min(1),
  quantity: z.number().int().min(1).max(15),
  category: z.nativeEnum(TaskCategory),
});
