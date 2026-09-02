import { Uuid } from "@wave-telecom/framework/core";
import { TaskCategory } from "../entities/task";
import { TaskGroup } from "../entities/task-group";

export interface searchTaskGroupsParams {
  category?: TaskCategory;
  nameContains?: string;
  educatorId?: Uuid;
}

export interface TaskGroupRepository {
  save(taskGroup: TaskGroup): Promise<TaskGroup>;
  findById(id: Uuid): Promise<TaskGroup | null>;
  findByIds(ids: Uuid[]): Promise<TaskGroup[]>;
  search(params: searchTaskGroupsParams): Promise<TaskGroup[]>;
  deleteById(id: Uuid): Promise<void>;
}
