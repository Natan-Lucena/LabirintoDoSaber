import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TeamRole } from "../../../../../domain/entities/clinic";
import { isLastAdmin } from "../../../../../domain/entities/clinic-member";
import { ClinicRepository } from "../../../../../domain/repositories/clinic-repository";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { findMembership, loadClinicView } from "../clinic-view";

export interface UpdateClinicMemberRoleUseCaseRequest {
  educatorId: Uuid;
  targetEducatorId: string;
  role: TeamRole;
}

export class UpdateClinicMemberRoleUseCase {
  constructor(
    private clinicRepository: ClinicRepository,
    private memberRepository: ClinicMemberRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: UpdateClinicMemberRoleUseCaseRequest) {
    const membership = await findMembership(
      this.memberRepository,
      this.clinicRepository,
      request.educatorId
    );
    if (!membership) return failure("NOT_IN_CLINIC" as const);
    // EQ-03: mudar papel é do ADMIN.
    if (!membership.member.isAdmin) return failure("FORBIDDEN_ROLE" as const);

    const { clinic } = membership;
    const members = await this.memberRepository.listByClinicId(clinic.id);
    const target = members.find((member) => member.educatorId.value === request.targetEducatorId);
    if (!target) return failure("MEMBER_NOT_FOUND" as const);

    // EQ-08: o último ADMIN não vira PROFESSIONAL.
    if (request.role !== "ADMIN" && isLastAdmin(target, members)) {
      return failure("LAST_ADMIN" as const);
    }

    if (target.role !== request.role) {
      await this.memberRepository.save(target.changeRole(request.role));
    }

    const myRole =
      target.educatorId.value === request.educatorId.value ? request.role : membership.member.role;

    return success(
      await loadClinicView(this.memberRepository, this.educatorRepository, clinic, myRole)
    );
  }
}
