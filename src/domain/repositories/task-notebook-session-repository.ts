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
  // Só destes alunos (GET /student/overview); ausente = todos (cron).
  studentIds?: Uuid[];
}

// Só o que o cron de notificações usa, sem respostas nem observação.
export interface FinishedSessionRef {
  id: Uuid;
  studentId: Uuid;
  educatorId: Uuid;
  finishedAt: Date;
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
  // Sessões finalizadas no intervalo, de todos os educadores (cron de
  // notificações) ou dos alunos informados, ordenadas por finishedAt e
  // depois id.
  listFinishedBetween(params: ListFinishedBetweenParams): Promise<FinishedSessionRef[]>;
}
