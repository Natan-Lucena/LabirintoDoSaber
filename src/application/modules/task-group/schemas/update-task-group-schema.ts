import z from 'zod';
import { TaskCategory } from '../../../../domain/entities/task';

export const UpdateTaskGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  tasksIds: z.array(z.string().uuid()).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
});