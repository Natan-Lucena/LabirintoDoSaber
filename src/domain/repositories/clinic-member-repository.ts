import { Uuid } from "@wave-telecom/framework/core";
import { ClinicMember } from "../entities/clinic-member";

// O educador já é membro de uma clínica (índice único em educatorId), por
// exemplo em dois aceites em paralelo.
export class ClinicMemberAlreadyExistsError extends Error {
  constructor() {
    super("ALREADY_IN_CLINIC");
    this.name = "ClinicMemberAlreadyExistsError";
  }
}

export interface ClinicMemberRepository {
  // Lança ClinicMemberAlreadyExistsError se o educador já está numa clínica.
  create(member: ClinicMember): Promise<void>;
  // Grava as mudanças de um membro existente (papel).
  save(member: ClinicMember): Promise<void>;
  findByEducatorId(educatorId: Uuid): Promise<ClinicMember | null>;
  listByClinicId(clinicId: Uuid): Promise<ClinicMember[]>;
  deleteByEducatorId(educatorId: Uuid): Promise<void>;
}
