import { Uuid } from "@wave-telecom/framework/core";
import { ActivityResult } from "../entities/activity-result";

// A atividade já tem resultado na sessão (índice único em sessionId + taskId),
// por exemplo num envio em paralelo.
export class ActivityResultAlreadyExistsError extends Error {
  constructor() {
    super("RESULT_ALREADY_EXISTS");
    this.name = "ActivityResultAlreadyExistsError";
  }
}

export interface ActivityResultRepository {
  // Lança ActivityResultAlreadyExistsError se a mesma atividade já tem
  // resultado gravado na sessão.
  save(result: ActivityResult): Promise<void>;
  findBySessionAndTask(sessionId: Uuid, taskId: Uuid): Promise<ActivityResult | null>;
  // Ordenados por recordedAt, mais antigo primeiro.
  listBySessionId(sessionId: Uuid): Promise<ActivityResult[]>;
  // Uma consulta para várias sessões, na mesma ordem de listBySessionId.
  listBySessionIds(sessionIds: Uuid[]): Promise<ActivityResult[]>;
}
