import { Uuid } from "@wave-telecom/framework/core";
import { Task, TaskCategory, TaskType } from "../entities/task";

export interface SearchTaskProps {
  id?: Uuid;
  category?: TaskCategory;
  type?: TaskType;
  promptContains?: string;
}

export interface TaskRepository {
  save(task: Task): Promise<void>;
  getById(id: Uuid): Promise<Task | null>;
  search(params: SearchTaskProps): Promise<Task[]>;
  delete(id: Uuid): Promise<void>;
}
