import { Uuid } from "@wave-telecom/framework/core";
import { ClinicInvite } from "../entities/clinic-invite";

// O código sorteado já existe (índice único em code). Quem cria sorteia outro.
export class InviteCodeTakenError extends Error {
  constructor() {
    super("INVITE_CODE_TAKEN");
    this.name = "InviteCodeTakenError";
  }
}

export interface ClinicInviteRepository {
  // Lança InviteCodeTakenError se o código já existe.
  create(invite: ClinicInvite): Promise<void>;
  findById(id: Uuid): Promise<ClinicInvite | null>;
  findByCode(code: string): Promise<ClinicInvite | null>;
  // Ativos: não usados, não revogados e dentro da validade. Mais recentes primeiro.
  listActiveByClinicId(clinicId: Uuid, now: Date): Promise<ClinicInvite[]>;
  countActiveByClinicId(clinicId: Uuid, now: Date): Promise<number>;

  // Marca o convite como usado por `usedBy` se ele ainda está ativo. Atômico e
  // condicional: com dois aceites em paralelo, só um consome. Devolve false
  // quando o convite já não estava ativo.
  consume(inviteId: Uuid, usedBy: Uuid, now: Date): Promise<boolean>;
  // Desfaz o consumo feito por `usedBy` (quando a entrada na clínica falha
  // depois de consumir).
  release(inviteId: Uuid, usedBy: Uuid): Promise<void>;

  // Marca o convite como revogado se ainda não foi. Atômico: só o campo
  // revokedAt muda, sem regravar o convite lido.
  revoke(inviteId: Uuid, revokedAt: Date): Promise<void>;
  // Revoga de uma vez os convites ativos da clínica; com `createdBy`, só os
  // criados por esse educador.
  revokeActive(filter: { clinicId: Uuid; createdBy?: Uuid }, now: Date): Promise<void>;
}
