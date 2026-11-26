import z from "zod";
import { TaskCategory, TaskType } from "../../../../domain/entities/task";

export const listTasksSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  type: z.nativeEnum(TaskType).optional(),
  promptContains: z.string().min(1).optional(),
});
