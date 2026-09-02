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
  // Insere um lote de tasks NOVAS numa única operação em lote — não faz
  // upsert por item. Para atualizar uma task existente, use save().
  saveMany(tasks: Task[]): Promise<void>;
  getById(id: Uuid): Promise<Task | null>;
  getByIds(ids: Uuid[]): Promise<Task[]>;
  search(params: SearchTaskProps): Promise<Task[]>;
  delete(id: Uuid): Promise<void>;
}
