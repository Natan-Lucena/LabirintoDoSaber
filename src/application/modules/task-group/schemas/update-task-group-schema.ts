import z from 'zod';
import { TaskCategory } from '../../../../domain/entities/task';

export const UpdateTaskGroupSchema = z.object({
  // Id inválido vira 404 TASK_GROUP_NOT_FOUND no use case.
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  tasksIds: z.array(z.string().uuid()).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
});