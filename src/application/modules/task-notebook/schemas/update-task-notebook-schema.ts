import z from "zod";
import { TaskNotebookCategory } from "../../../../domain/entities/task-notebook";

export const UpdateTaskNotebookSchema = z.object({
  // Id inválido vira 404 TASK_NOTEBOOK_NOT_FOUND no use case.
  taskNotebookId: z.string().min(1),
  category: z.nativeEnum(TaskNotebookCategory).optional(),
  description: z.string().min(1).max(500).optional(),
  taskGroupsIds: z.array(z.string().uuid()).optional(),
});