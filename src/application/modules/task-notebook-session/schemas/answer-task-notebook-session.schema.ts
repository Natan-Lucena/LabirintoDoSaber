import z from "zod";

export const answerTaskNotebookSessionSchema = z.object({
  sessionId: z.string().uuid(),
  taskId: z.string().uuid(),
  selectedAlternativeId: z.string().uuid(),
  // Em milissegundos.
  timeToAnswer: z.number().min(0),
});
