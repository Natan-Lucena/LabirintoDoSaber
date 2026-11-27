import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ClinicRepository } from "../../../../../domain/repositories/clinic-repository";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { findMembership, loadClinicView } from "../clinic-view";

export interface GetClinicUseCaseRequest {
  educatorId: Uuid;
}

export class GetClinicUseCase {
  constructor(
    private clinicRepository: ClinicRepository,
    private memberRepository: ClinicMemberRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: GetClinicUseCaseRequest) {
    const membership = await findMembership(
      this.memberRepository,
      this.clinicRepository,
      request.educatorId
    );
    if (!membership) return failure("NOT_IN_CLINIC" as const);

    return success(
      await loadClinicView(
        this.memberRepository,
        this.educatorRepository,
        membership.clinic,
        membership.member.role
      )
    );
  }
}
