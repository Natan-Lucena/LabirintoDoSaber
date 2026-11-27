import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Clinic } from "../../../../../domain/entities/clinic";
import { ClinicMember } from "../../../../../domain/entities/clinic-member";
import { ClinicRepository } from "../../../../../domain/repositories/clinic-repository";
import {
  ClinicMemberAlreadyExistsError,
  ClinicMemberRepository,
} from "../../../../../domain/repositories/clinic-member-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { loadClinicView } from "../clinic-view";

export interface CreateClinicUseCaseRequest {
  educatorId: Uuid;
  name: string;
}

export class CreateClinicUseCase {
  constructor(
    private clinicRepository: ClinicRepository,
    private memberRepository: ClinicMemberRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: CreateClinicUseCaseRequest) {
    // EQ-01: uma clínica por educador.
    if (await this.memberRepository.findByEducatorId(request.educatorId)) {
      return failure("ALREADY_IN_CLINIC" as const);
    }

    const created = Clinic.create({ name: request.name });
    if (!created.ok) return created;
    const clinic = created.value;

    // EQ-02: quem cria vira ADMIN.
    const member = ClinicMember.create({
      clinicId: clinic.id,
      educatorId: request.educatorId,
      role: "ADMIN",
    });

    await this.clinicRepository.save(clinic);
    try {
      await this.memberRepository.create(member);
    } catch (error) {
      // Entrou noutra clínica em paralelo: a clínica nova fica sem ninguém.
      if (error instanceof ClinicMemberAlreadyExistsError) {
        await this.clinicRepository.delete(clinic.id);
        return failure("ALREADY_IN_CLINIC" as const);
      }
      throw error;
    }

    return success(
      await loadClinicView(this.memberRepository, this.educatorRepository, clinic, member.role)
    );
  }
}
