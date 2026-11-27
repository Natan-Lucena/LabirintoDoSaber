import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ClinicRepository } from "../../../../../domain/repositories/clinic-repository";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { findMembership, loadClinicView } from "../clinic-view";

export interface UpdateClinicUseCaseRequest {
  educatorId: Uuid;
  name: string;
}

export class UpdateClinicUseCase {
  constructor(
    private clinicRepository: ClinicRepository,
    private memberRepository: ClinicMemberRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: UpdateClinicUseCaseRequest) {
    const membership = await findMembership(
      this.memberRepository,
      this.clinicRepository,
      request.educatorId
    );
    if (!membership) return failure("NOT_IN_CLINIC" as const);
    // EQ-03: renomear é do ADMIN.
    if (!membership.member.isAdmin) return failure("FORBIDDEN_ROLE" as const);

    const renamed = membership.clinic.rename(request.name);
    if (!renamed.ok) return renamed;

    await this.clinicRepository.save(renamed.value);

    return success(
      await loadClinicView(
        this.memberRepository,
        this.educatorRepository,
        renamed.value,
        membership.member.role
      )
    );
  }
}
