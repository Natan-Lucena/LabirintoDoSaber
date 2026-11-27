import { Uuid } from "@wave-telecom/framework/core";
import { Task } from "../entities/task";

export interface TaskRepository {
  save(task: Task): Promise<void>;
  // Insere um lote de tasks NOVAS numa única operação em lote — não faz
  // upsert por item. Para atualizar uma task existente, use save().
  saveMany(tasks: Task[]): Promise<void>;
  getById(id: Uuid): Promise<Task | null>;
  getByIds(ids: Uuid[]): Promise<Task[]>;
  // Tarefas EDUCATOR que o educador usa: as dele e as antigas sem dono
  // gravado que estão num caderno ou grupo dele ou fora de qualquer caderno e
  // grupo ("legado avulso", de todos). Ver isUsableBy.
  listByEducator(educatorId: Uuid): Promise<Task[]>;
  // Para tarefas antigas sem dono: id da tarefa → educadores donos dos
  // cadernos e grupos em que ela está (lista vazia = legado avulso).
  findLegacyOwners(taskIds: Uuid[]): Promise<Map<string, string[]>>;
  // Biblioteca (source LIBRARY), de todos os educadores.
  listLibrary(): Promise<Task[]>;
  delete(id: Uuid): Promise<void>;
}
