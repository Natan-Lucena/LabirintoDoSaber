import z from "zod";
import {
  ACTIVITY_RESULT_MAX_ATTEMPTS,
  ACTIVITY_RESULT_MAX_DURATION_MS,
  ACTIVITY_RESULT_MAX_ERRORS,
} from "../../../../domain/entities/activity-result";

export const recordActivityResultSchema = z.object({
  // Id inválido vira 404 SESSION_NOT_FOUND / TASK_NOT_FOUND no use case.
  sessionId: z.string(),
  taskId: z.string(),
  completed: z.boolean(),
  correct: z.boolean(),
  attempts: z.number().int().min(1).max(ACTIVITY_RESULT_MAX_ATTEMPTS),
  errors: z.number().int().min(0).max(ACTIVITY_RESULT_MAX_ERRORS),
  durationMs: z.number().int().min(0).max(ACTIVITY_RESULT_MAX_DURATION_MS),
});
