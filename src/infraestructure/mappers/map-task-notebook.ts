import { TaskNotebook } from "../../domain/entities/task-notebook";
import { mapEducatorToResponse } from "./map-educator";

export const mapTaskNotebookToResponse = (notebook: TaskNotebook) => {
  return {
    id: notebook.id.value,
    educator: mapEducatorToResponse(notebook.educator),
    tasks: notebook.tasks,
    category: notebook.category,
    description: notebook.description,
    createdAt: notebook.createdAt,
    taskGroupsIds: notebook.taskGroupsIds,
  };
};
