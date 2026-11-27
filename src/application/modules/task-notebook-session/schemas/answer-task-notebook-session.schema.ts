import z from "zod";

export const answerTaskNotebookSessionSchema = z.object({
  // Id inválido vira 404 SESSION_NOT_FOUND / TASK_NOT_FOUND no use case.
  sessionId: z.string(),
  taskId: z.string(),
  selectedAlternativeId: z.string().uuid(),
  // Em milissegundos.
  timeToAnswer: z.number().min(0),
});
