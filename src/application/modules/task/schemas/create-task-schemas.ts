import z from "zod";
import { TaskCategory, TaskType } from "../../../../domain/entities/task";

export const taskFieldsSchema = z.object({
  category: z.nativeEnum(TaskCategory),
  type: z.nativeEnum(TaskType),
  prompt: z.string().min(1),
  alternatives: z
    .array(
      z.object({
        text: z.string().min(1),
        isCorrect: z.boolean(),
      })
    )
    .min(2),
});

export const createTaskSchema = taskFieldsSchema;
