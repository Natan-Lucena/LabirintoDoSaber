import bcrypt from "bcrypt";
import { failure, success } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { normalizeInviteCode } from "../../../../../domain/entities/clinic-invite";
import { ClinicMember } from "../../../../../domain/entities/clinic-member";
import { ClinicInviteRepository } from "../../../../../domain/repositories/clinic-invite-repository";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { RateLimitRepository } from "../../../../../domain/repositories/rate-limit-repository";
import { consumeIpQuota } from "../../../clinic/use-cases/ip-rate-limit";

const SALT_ROUNDS = 10;

interface RegisterEducatorUseCaseRequest {
  name: string;
  email: string;
  password: string;
  inviteCode?: string;
  // IP do cliente: conta na cota de resgate de convites quando vem inviteCode.
  ip: string;
}

export class RegisterEducatorUseCase {
  constructor(
    private educatorRepository: EducatorRepository,
    private inviteRepository: ClinicInviteRepository,
    private memberRepository: ClinicMemberRepository,
    private rateLimitRepository: RateLimitRepository
  ) {}

  async execute(props: RegisterEducatorUseCaseRequest) {
    const now = new Date();

    // Contra tentativa e erro de códigos: cota por IP, dividida com o aceite.
    if (
      props.inviteCode !== undefined &&
      !(await consumeIpQuota(this.rateLimitRepository, "invite-redeem", props.ip, now))
    ) {
      return failure("TOO_MANY_REQUESTS");
    }

    const userAlreadyExists = await this.educatorRepository.getByEmail(
      props.email
    );

    if (userAlreadyExists) {
      return failure("EDUCATOR_ALREADY_EXISTS");
    }

    // EQ-06: o convite é validado antes de criar a conta; inválido não cria nada.
    let invite = null;
    if (props.inviteCode !== undefined) {
      const code = normalizeInviteCode(props.inviteCode);
      invite = code ? await this.inviteRepository.findByCode(code) : null;
      if (!invite || !invite.isActive(now)) return failure("INVITE_INVALID");
    }

    const hash = await bcrypt.hash(props.password, SALT_ROUNDS);

    const educator = Educator.create({
      name: props.name,
      email: props.email,
      password: hash,
    });

    await this.educatorRepository.save(educator);

    if (invite) {
      // Sem transação: conta, consumo atômico e membro em sequência. Se outro
      // cadastro ou aceite consumiu o convite nesse meio-tempo, a conta criada
      // é desfeita.
      const consumed = await this.inviteRepository.consume(invite.id, educator.id, now);
      if (!consumed) {
        await this.educatorRepository.delete(educator.id);
        return failure("INVITE_INVALID");
      }

      try {
        await this.memberRepository.create(
          ClinicMember.create({
            clinicId: invite.clinicId,
            educatorId: educator.id,
            role: invite.role,
            now,
          })
        );
      } catch (error) {
        // Falha do banco depois do consumo: o convite volta a valer e a conta
        // é desfeita, para o cadastro poder ser repetido.
        await this.inviteRepository.release(invite.id, educator.id);
        await this.educatorRepository.delete(educator.id);
        throw error;
      }
    }

    const res = ({
      id: educator.id,
      name: educator.name,
    })

    return success(res);
  }
}
