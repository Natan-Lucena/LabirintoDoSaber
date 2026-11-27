import { ActivityResult } from "../../domain/entities/activity-result";

export const mapActivityResultToResponse = (result: ActivityResult) => ({
  id: result.id.value,
  sessionId: result.sessionId.value,
  taskId: result.taskId.value,
  taskType: result.taskType,
  completed: result.completed,
  correct: result.correct,
  attempts: result.attempts,
  errors: result.errors,
  durationMs: result.durationMs,
  recordedAt: result.recordedAt,
});
