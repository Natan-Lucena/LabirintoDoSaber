import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { ClinicInviteRepository } from "../../../../../domain/repositories/clinic-invite-repository";

export interface RevokeClinicInviteUseCaseRequest {
  educatorId: Uuid;
  inviteId: string;
}

export class RevokeClinicInviteUseCase {
  constructor(
    private memberRepository: ClinicMemberRepository,
    private inviteRepository: ClinicInviteRepository
  ) {}

  async execute(request: RevokeClinicInviteUseCaseRequest) {
    const member = await this.memberRepository.findByEducatorId(request.educatorId);
    if (!member) return failure("NOT_IN_CLINIC" as const);
    if (!member.isAdmin) return failure("FORBIDDEN_ROLE" as const);

    if (!Uuid.isValid(request.inviteId)) return failure("INVITE_NOT_FOUND" as const);
    const invite = await this.inviteRepository.findById(new Uuid(request.inviteId));
    if (!invite || invite.clinicId.value !== member.clinicId.value) {
      return failure("INVITE_NOT_FOUND" as const);
    }

    // Atômico e condicional: revogar de novo não muda a data da revogação.
    await this.inviteRepository.revoke(invite.id, new Date());

    return success(undefined);
  }
}
