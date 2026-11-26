import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { ClinicRepository } from "../../../../../domain/repositories/clinic-repository";
import { mapEducatorToResponse } from "../../../../../infraestructure/mappers/map-educator";
import { TeamRole } from "../../../../../domain/entities/clinic";

interface GetEducatorProfileUseCaseRequest {
  educatorId: Uuid;
}

export class GetEducatorProfileUseCase {
  constructor(
    private educatorRepository: EducatorRepository,
    private memberRepository: ClinicMemberRepository,
    private clinicRepository: ClinicRepository
  ) {}

  async execute(request: GetEducatorProfileUseCaseRequest) {
    const educatorUuid = request.educatorId;

    const educators = await this.educatorRepository.search({
      id: educatorUuid,
    });

    if (!educators || educators.length === 0) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    const educator = educators[0];
    const profile: ReturnType<typeof mapEducatorToResponse> & {
      clinic?: { id: string; name: string; role: TeamRole };
    } = mapEducatorToResponse(educator);

    // Clínica do educador, ausente quando ele não tem uma.
    const member = await this.memberRepository.findByEducatorId(educator.id);
    const clinic = member ? await this.clinicRepository.findById(member.clinicId) : null;
    if (member && clinic) {
      profile.clinic = { id: clinic.id.value, name: clinic.name, role: member.role };
    }

    return success(profile);
  }
}
