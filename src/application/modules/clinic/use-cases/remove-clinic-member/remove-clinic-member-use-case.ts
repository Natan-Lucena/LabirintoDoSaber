import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { isLastAdmin } from "../../../../../domain/entities/clinic-member";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { ClinicDepartureService } from "../../../../../domain/services/clinic-departure-service";

export interface RemoveClinicMemberUseCaseRequest {
  educatorId: Uuid;
  // O próprio id = sair da clínica.
  targetEducatorId: string;
}

export class RemoveClinicMemberUseCase {
  constructor(
    private memberRepository: ClinicMemberRepository,
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

    // EQ-08: o último ADMIN não sai nem é removido.
    if (isLastAdmin(target, members)) return failure("LAST_ADMIN" as const);

    // EQ-09: desfaz os compartilhamentos antes de tirar o vínculo; os
    // pacientes dos quais ele é dono continuam com ele.
    await this.departureService.undoSharesOf(target.clinicId, target.educatorId);
    await this.memberRepository.deleteByEducatorId(target.educatorId);

    return success(undefined);
  }
}
