import z from 'zod';

export const deleteTaskGroupSchema = z.object({
  // Id inválido vira 404 TASK_GROUP_NOT_FOUND no use case.
  taskGroupId: z.string().min(1),
});