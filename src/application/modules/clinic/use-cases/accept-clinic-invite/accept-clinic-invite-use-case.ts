import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { normalizeInviteCode } from "../../../../../domain/entities/clinic-invite";
import { ClinicMember } from "../../../../../domain/entities/clinic-member";
import { ClinicRepository } from "../../../../../domain/repositories/clinic-repository";
import {
  ClinicMemberAlreadyExistsError,
  ClinicMemberRepository,
} from "../../../../../domain/repositories/clinic-member-repository";
import { ClinicInviteRepository } from "../../../../../domain/repositories/clinic-invite-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { RateLimitRepository } from "../../../../../domain/repositories/rate-limit-repository";
import { loadClinicView } from "../clinic-view";
import { consumeIpQuota } from "../ip-rate-limit";

export interface AcceptClinicInviteUseCaseRequest {
  educatorId: Uuid;
  code: string;
  ip: string;
}

export class AcceptClinicInviteUseCase {
  constructor(
    private clinicRepository: ClinicRepository,
    private memberRepository: ClinicMemberRepository,
    private inviteRepository: ClinicInviteRepository,
    private educatorRepository: EducatorRepository,
    private rateLimitRepository: RateLimitRepository
  ) {}

  async execute(request: AcceptClinicInviteUseCaseRequest) {
    const now = new Date();

    // Contra tentativa e erro de códigos: cota por IP, dividida com o cadastro
    // com convite.
    if (!(await consumeIpQuota(this.rateLimitRepository, "invite-redeem", request.ip, now))) {
      return failure("TOO_MANY_REQUESTS" as const);
    }

    // EQ-01: quem já está numa clínica não aceita outra.
    if (await this.memberRepository.findByEducatorId(request.educatorId)) {
      return failure("ALREADY_IN_CLINIC" as const);
    }

    // EQ-06: vencido, usado, revogado ou inexistente são o mesmo erro.
    const code = normalizeInviteCode(request.code);
    const invite = code ? await this.inviteRepository.findByCode(code) : null;
    if (!invite || !invite.isActive(now)) return failure("INVITE_INVALID" as const);

    const clinic = await this.clinicRepository.findById(invite.clinicId);
    if (!clinic) return failure("INVITE_INVALID" as const);

    // EQ-04: uso único. Com dois aceites em paralelo, só um consome.
    const consumed = await this.inviteRepository.consume(invite.id, request.educatorId, now);
    if (!consumed) return failure("INVITE_INVALID" as const);

    const member = ClinicMember.create({
      clinicId: clinic.id,
      educatorId: request.educatorId,
      role: invite.role,
      now,
    });
    try {
      await this.memberRepository.create(member);
    } catch (error) {
      // Entrou noutra clínica em paralelo: o convite volta a valer.
      if (error instanceof ClinicMemberAlreadyExistsError) {
        await this.inviteRepository.release(invite.id, request.educatorId);
        return failure("ALREADY_IN_CLINIC" as const);
      }
      throw error;
    }

    return success(
      await loadClinicView(this.memberRepository, this.educatorRepository, clinic, member.role)
    );
  }
}
