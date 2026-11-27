import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ClinicRepository } from "../../../../../domain/repositories/clinic-repository";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { ClinicInviteRepository } from "../../../../../domain/repositories/clinic-invite-repository";
import { findMembership } from "../clinic-view";

export interface ListClinicInvitesUseCaseRequest {
  educatorId: Uuid;
}

export class ListClinicInvitesUseCase {
  constructor(
    private clinicRepository: ClinicRepository,
    private memberRepository: ClinicMemberRepository,
    private inviteRepository: ClinicInviteRepository
  ) {}

  async execute(request: ListClinicInvitesUseCaseRequest) {
    const membership = await findMembership(
      this.memberRepository,
      this.clinicRepository,
      request.educatorId
    );
    if (!membership) return failure("NOT_IN_CLINIC" as const);
    if (!membership.member.isAdmin) return failure("FORBIDDEN_ROLE" as const);

    const invites = await this.inviteRepository.listActiveByClinicId(
      membership.clinic.id,
      new Date()
    );

    return success({ invites, clinic: membership.clinic });
  }
}
