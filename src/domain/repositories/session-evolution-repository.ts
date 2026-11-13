import { Uuid } from "@wave-telecom/framework/core";
import { SessionEvolution } from "../entities/session-evolution";

export interface SearchSessionEvolutionParams {
  educatorId: Uuid;
  studentId?: Uuid;
  // AAAA-MM-DD, inclusivos, comparados com sessionDate.
  from?: string;
  to?: string;
  limit: number;
}

export interface SessionEvolutionRepository {
  save(evolution: SessionEvolution): Promise<void>;
  findById(id: Uuid): Promise<SessionEvolution | null>;
  findBySessionId(sessionId: Uuid): Promise<SessionEvolution | null>;
  // Ordenado por sessionDate e depois createdAt, mais recente primeiro.
  search(params: SearchSessionEvolutionParams): Promise<SessionEvolution[]>;
  // sessionId → id da evolução, só para as sessões que têm evolução.
  findIdsBySessionIds(sessionIds: Uuid[]): Promise<Map<string, string>>;
}
