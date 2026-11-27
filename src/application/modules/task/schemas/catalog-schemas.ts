import z from "zod";
import {
  TaskCategory,
  TaskFormat,
  TaskSource,
  TaskType,
} from "../../../../domain/entities/task";

export const catalogSchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  format: z.nativeEnum(TaskFormat).optional(),
  type: z.nativeEnum(TaskType).optional(),
  skill: z.string().trim().min(1).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  // Ausente = biblioteca e as do educador.
  source: z.nativeEnum(TaskSource).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
});

export const recommendedSchema = z.object({
  studentId: z.string().uuid(),
});
