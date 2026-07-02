import z from "zod";
import { TaskCategory } from "../../../../domain/entities/task";
import { taskFieldsSchema } from "./create-task-schemas";

const batchTaskSchema = taskFieldsSchema.extend({
  imageFile: z.string().url().optional(),
  audioFile: z.string().url().optional(),
});

export const saveTaskBatchSchema = z.object({
  name: z.string().min(1),
  category: z.nativeEnum(TaskCategory),
  tasks: z.array(batchTaskSchema).min(1),
});
