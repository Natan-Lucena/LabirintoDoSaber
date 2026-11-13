import bcrypt from "bcrypt";
import { failure, success } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import { checkRecoveryCode } from "../check-recovery-code";

const SALT_ROUNDS = 10;

interface UpdatePasswordEducatorUseCaseRequest {
  email: string;
  token: string;
  newPassword: string;
}

// Redefine a senha com o código de recuperação enviado por e-mail.
export class UpdatePasswordEducatorUseCase {
  constructor(
    private educatorRepository: EducatorRepository,
    private authTokenRepository: AuthTokenRepository
  ) {}

  async execute(request: UpdatePasswordEducatorUseCaseRequest) {
    // E-mail inexistente responde como código inválido, para não revelar a conta.
    const educator = await this.educatorRepository.getByEmail(request.email);
    if (!educator) {
      return failure("INVALID_TOKEN");
    }

    const authToken = await this.authTokenRepository.findByUserId(educator.id);
    if (!authToken) {
      return failure("INVALID_TOKEN");
    }

    const now = new Date();
    const checked = await checkRecoveryCode(
      this.authTokenRepository,
      authToken,
      request.token,
      now
    );
    if (!checked.ok) {
      return failure(checked.error);
    }

    if (await bcrypt.compare(request.newPassword, educator.password)) {
      return failure("PASSWORD_SAME_AS_OLD");
    }

    // Uso único: só troca a senha quem conseguiu consumir o código.
    if (!(await this.authTokenRepository.consume(authToken, now))) {
      return failure("INVALID_TOKEN");
    }

    const hash = await bcrypt.hash(request.newPassword, SALT_ROUNDS);
    educator.updatePassword(hash, now);
    await this.educatorRepository.save(educator);

    return success(void 0);
  }
}
