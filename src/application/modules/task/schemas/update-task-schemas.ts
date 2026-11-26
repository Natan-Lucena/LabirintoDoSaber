import z from "zod";
import { TaskCategory, TaskTone, TaskType } from "../../../../domain/entities/task";
import { alternativeSchema, skillsSchema, themeSchema } from "./create-task-schemas";

// Id inválido vira 404 TASK_NOT_FOUND no use case.
export const updateTaskSchema = z.object({
  id: z.string().min(1),
  category: z.nativeEnum(TaskCategory).optional(),
  type: z.nativeEnum(TaskType).optional(),
  prompt: z.string().trim().min(1).optional(),
  alternatives: z.array(alternativeSchema).optional(),
  imageFile: z.string().optional(),
  audioFile: z.string().optional(),
  content: z.unknown().optional(),
  skills: skillsSchema.optional(),
  theme: themeSchema.optional(),
  tone: z.nativeEnum(TaskTone).optional(),
});
