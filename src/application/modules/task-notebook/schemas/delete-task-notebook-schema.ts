import z from 'zod';

export const DeleteTaskNotebookSchema = z.object({
  // Id inválido vira 404 TASK_NOTEBOOK_NOT_FOUND no use case.
  taskNotebookId: z.string().min(1),
});