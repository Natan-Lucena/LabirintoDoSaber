import { Uuid } from "@wave-telecom/framework/core";
import { Task } from "../entities/task";

export interface TaskRepository {
  save(task: Task): Promise<void>;
  // Insere um lote de tasks NOVAS numa única operação em lote — não faz
  // upsert por item. Para atualizar uma task existente, use save().
  saveMany(tasks: Task[]): Promise<void>;
  getById(id: Uuid): Promise<Task | null>;
  getByIds(ids: Uuid[]): Promise<Task[]>;
  // Tarefas EDUCATOR do educador. As antigas, sem dono gravado, contam como
  // dele quando estão num caderno ou grupo dele.
  listByEducator(educatorId: Uuid): Promise<Task[]>;
  // Biblioteca (source LIBRARY), de todos os educadores.
  listLibrary(): Promise<Task[]>;
  delete(id: Uuid): Promise<void>;
}
