import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskNotebookCategory } from "../../../../../domain/entities/task-notebook";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";

interface ListTasksNotebooksUseCaseRequest {
  id?: Uuid;
  educatorId?: Uuid;
  category?: TaskNotebookCategory;
  descriptionContains?: string;
}

export class ListTasksNotebooksUseCase {
  constructor(
    private taskNotebookRepository: TaskNotebookRepository,
    private taskGroupRepository: TaskGroupRepository
  ) {}

  async execute(params: ListTasksNotebooksUseCaseRequest) {
    try {
      const notebooks = await this.taskNotebookRepository.search(params);

      const uniqueGroupIds = new Map<string, Uuid>();
      for (const notebook of notebooks) {
        for (const groupId of notebook.taskGroupsIds) {
          uniqueGroupIds.set(groupId, new Uuid(groupId));
        }
      }

      const taskGroups = uniqueGroupIds.size
        ? await this.taskGroupRepository.findByIds(
            Array.from(uniqueGroupIds.values()),
          )
        : [];
      const taskGroupById = new Map(
        taskGroups.map((group) => [group.id.value, group]),
      );

      const result = notebooks.map((notebook) => ({
        notebook: {
          id: notebook.id.value,
          educator: notebook.educator.id.value,
          tasks: notebook.tasks.map((task) => task.id.value),
          category: notebook.category,
          description: notebook.description,
          createdAt: notebook.createdAt,
          taskGroupsIds: notebook.taskGroupsIds,
        },
        taskGroups: notebook.taskGroupsIds
          .map((groupId) => taskGroupById.get(groupId))
          .filter((g): g is NonNullable<typeof g> => g !== undefined),
      }));

      return success(result);
    } catch {
      return failure("LIST_TASKS_NOTEBOOKS_FAILED");
    }
  }
}
