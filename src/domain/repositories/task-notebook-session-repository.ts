import { Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSession } from "../entities/task-notebook-session";

export interface ListByEducatorIdParams {
  educatorId: Uuid;
  limit: number;
}

export interface ListFinishedByEducatorSinceParams {
  educatorId: Uuid;
  since: Date;
}

export interface ListFinishedBetweenParams {
  // Inclusivos, comparados com finishedAt.
  from: Date;
  to: Date;
}

export interface TaskNotebookSessionRepository {
  save(session: TaskNotebookSession): Promise<void>;
  getById(id: Uuid): Promise<TaskNotebookSession | null>;
  listByStudentId(studentId: Uuid): Promise<TaskNotebookSession[]>;
  listByEducatorId(
    params: ListByEducatorIdParams
  ): Promise<TaskNotebookSession[]>;
  // Sessões do educador finalizadas a partir de `since`, mais recentes primeiro.
  listFinishedByEducatorSince(
    params: ListFinishedByEducatorSinceParams
  ): Promise<TaskNotebookSession[]>;
  // Sessões de todos os educadores finalizadas no intervalo (cron de notificações).
  listFinishedBetween(params: ListFinishedBetweenParams): Promise<TaskNotebookSession[]>;
}
