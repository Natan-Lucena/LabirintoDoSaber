import z from "zod";

export const addObservationTaskNotebookSessionSchema = z.object({
  // Id inválido vira 404 SESSION_NOT_FOUND no use case.
  sessionId: z.string().min(1),
  observation: z.string().min(1),
});
