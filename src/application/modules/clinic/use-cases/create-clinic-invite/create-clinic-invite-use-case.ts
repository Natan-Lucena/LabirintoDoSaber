import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TeamRole } from "../../../../../domain/entities/clinic";
import { ClinicInvite, MAX_ACTIVE_INVITES } from "../../../../../domain/entities/clinic-invite";
import { ClinicRepository } from "../../../../../domain/repositories/clinic-repository";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import {
  ClinicInviteRepository,
  InviteCodeTakenError,
} from "../../../../../domain/repositories/clinic-invite-repository";
import { findMembership } from "../clinic-view";

// Com 32^8 códigos possíveis, colisões seguidas indicam outro problema.
const MAX_CODE_ATTEMPTS = 5;

export interface CreateClinicInviteUseCaseRequest {
  educatorId: Uuid;
  role: TeamRole;
}

export class CreateClinicInviteUseCase {
  constructor(
    private clinicRepository: ClinicRepository,
    private memberRepository: ClinicMemberRepository,
    private inviteRepository: ClinicInviteRepository
  ) {}

  async execute(request: CreateClinicInviteUseCaseRequest) {
    const membership = await findMembership(
      this.memberRepository,
      this.clinicRepository,
      request.educatorId
    );
    if (!membership) return failure("NOT_IN_CLINIC" as const);
    // EQ-03: convites são do ADMIN.
    if (!membership.member.isAdmin) return failure("FORBIDDEN_ROLE" as const);

    const { clinic } = membership;
    const now = new Date();

    // EQ-04: no máximo 20 ativos por clínica.
    const active = await this.inviteRepository.countActiveByClinicId(clinic.id, now);
    if (active >= MAX_ACTIVE_INVITES) return failure("TOO_MANY_INVITES" as const);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const invite = ClinicInvite.create({
        clinicId: clinic.id,
        role: request.role,
        createdBy: request.educatorId,
        now,
      });
      try {
        await this.inviteRepository.create(invite);
        return success({ invite, clinic });
      } catch (error) {
        if (!(error instanceof InviteCodeTakenError)) throw error;
      }
    }

    return failure("INVITE_CODE_UNAVAILABLE" as const);
  }
}
