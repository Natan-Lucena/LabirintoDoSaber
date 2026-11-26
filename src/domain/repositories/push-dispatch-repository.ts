import { Uuid } from "@wave-telecom/framework/core";

// Registro do push diário de cada educador (PU-04, BE-PU-01).
export interface PushDispatchRepository {
  // Reserva o push do dia `date` (AAAA-MM-DD) para o educador. Devolve false
  // se ele já foi reservado, inclusive por outro cron em paralelo.
  claim(educatorId: Uuid, date: string, now: Date): Promise<boolean>;
  deleteCreatedBefore(date: Date): Promise<number>;
}
