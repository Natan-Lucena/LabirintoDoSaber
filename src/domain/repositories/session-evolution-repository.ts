import { Uuid } from "@wave-telecom/framework/core";
import { SessionEvolution } from "../entities/session-evolution";

export interface SearchSessionEvolutionParams {
  // Alunos cujo dono atual é o educador; o autor gravado na evolução não entra.
  studentIds: Uuid[];
  // AAAA-MM-DD, inclusivos, comparados com sessionDate.
  from?: string;
  to?: string;
  limit: number;
}

// A sessão já tem evolução (índice único em sessionId), por exemplo numa
// criação em paralelo.
export class SessionEvolutionAlreadyExistsError extends Error {
  constructor() {
    super("SESSION_EVOLUTION_ALREADY_EXISTS");
    this.name = "SessionEvolutionAlreadyExistsError";
  }
}

export interface SessionEvolutionRepository {
  // Lança SessionEvolutionAlreadyExistsError se outra evolução da mesma
  // sessão já foi gravada.
  save(evolution: SessionEvolution): Promise<void>;
  findById(id: Uuid): Promise<SessionEvolution | null>;
  findBySessionId(sessionId: Uuid): Promise<SessionEvolution | null>;
  // Ordenado por sessionDate e depois createdAt, mais recente primeiro.
  search(params: SearchSessionEvolutionParams): Promise<SessionEvolution[]>;
  // sessionId → id da evolução, só para as sessões que têm evolução.
  findIdsBySessionIds(sessionIds: Uuid[]): Promise<Map<string, string>>;
}
