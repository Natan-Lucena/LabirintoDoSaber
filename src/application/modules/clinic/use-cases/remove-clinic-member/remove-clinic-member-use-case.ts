import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { isLastAdmin } from "../../../../../domain/entities/clinic-member";
import { ClinicRepository } from "../../../../../domain/repositories/clinic-repository";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { ClinicInviteRepository } from "../../../../../domain/repositories/clinic-invite-repository";
import { ClinicDepartureService } from "../../../../../domain/services/clinic-departure-service";

export interface RemoveClinicMemberUseCaseRequest {
  educatorId: Uuid;
  // O próprio id = sair da clínica.
  targetEducatorId: string;
}

export class RemoveClinicMemberUseCase {
  constructor(
    private clinicRepository: ClinicRepository,
    private memberRepository: ClinicMemberRepository,
    private inviteRepository: ClinicInviteRepository,
    private departureService: ClinicDepartureService
  ) {}

  async execute(request: RemoveClinicMemberUseCaseRequest) {
    const actor = await this.memberRepository.findByEducatorId(request.educatorId);
    if (!actor) return failure("NOT_IN_CLINIC" as const);

    // EQ-03: remover outro membro é do ADMIN; sair, qualquer um.
    const leaving = request.targetEducatorId === request.educatorId.value;
    if (!leaving && !actor.isAdmin) return failure("FORBIDDEN_ROLE" as const);

    const members = await this.memberRepository.listByClinicId(actor.clinicId);
    const target = members.find((member) => member.educatorId.value === request.targetEducatorId);
    if (!target) return failure("MEMBER_NOT_FOUND" as const);

    const { clinicId, educatorId } = target;
    const now = new Date();

    // Único membro: sai e a clínica acaba, com os convites ativos revogados.
    if (members.length === 1) {
      await this.departureService.undoSharesOf(clinicId, educatorId);
      await this.memberRepository.deleteByEducatorId(educatorId);
      await this.inviteRepository.revokeActive({ clinicId }, now);
      await this.clinicRepository.delete(clinicId);
      return success(undefined);
    }

    // EQ-08: com outros membros, o último ADMIN não sai nem é removido.
    if (isLastAdmin(target, members)) return failure("LAST_ADMIN" as const);

    // EQ-09: desfaz os compartilhamentos antes de tirar o vínculo; os
    // pacientes dos quais ele é dono continuam com ele.
    await this.departureService.undoSharesOf(clinicId, educatorId);
    await this.memberRepository.deleteByEducatorId(educatorId);
    // Os convites ativos que um ADMIN criou deixam de valer quando ele sai.
    if (target.isAdmin) {
      await this.inviteRepository.revokeActive({ clinicId, createdBy: educatorId }, now);
    }

    return success(undefined);
  }
}
