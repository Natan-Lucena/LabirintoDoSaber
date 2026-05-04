import z from "zod";

export const addObservationTaskNotebookSessionSchema = z.object({
  sessionId: z.string().uuid(),
  observation: z.string().min(1),
});
