import bcrypt from "bcrypt";
import { failure, success } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { normalizeInviteCode } from "../../../../../domain/entities/clinic-invite";
import { ClinicMember } from "../../../../../domain/entities/clinic-member";
import { ClinicInviteRepository } from "../../../../../domain/repositories/clinic-invite-repository";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";

const SALT_ROUNDS = 10;

interface RegisterEducatorUseCaseRequest {
  name: string;
  email: string;
  password: string;
  inviteCode?: string;
}

export class RegisterEducatorUseCase {
  constructor(
    private educatorRepository: EducatorRepository,
    private inviteRepository: ClinicInviteRepository,
    private memberRepository: ClinicMemberRepository
  ) {}

  async execute(props: RegisterEducatorUseCaseRequest) {
    const userAlreadyExists = await this.educatorRepository.getByEmail(
      props.email
    );

    if (userAlreadyExists) {
      return failure("EDUCATOR_ALREADY_EXISTS");
    }

    // EQ-06: o convite é validado antes de criar a conta; inválido não cria nada.
    const now = new Date();
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

      await this.memberRepository.create(
        ClinicMember.create({
          clinicId: invite.clinicId,
          educatorId: educator.id,
          role: invite.role,
          now,
        })
      );
    }

    const res = ({
      id: educator.id,
      name: educator.name,
    })

    return success(res);
  }
}
