import { failure, success } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import { checkRecoveryCode } from "../check-recovery-code";

interface VerifyTokenUseCaseRequest {
  email: string;
  token: string;
}

// Confere o código de recuperação sem consumi-lo. A conferência conta como
// tentativa.
export class VerifyTokenUseCase {
  constructor(
    private educatorRepository: EducatorRepository,
    private authTokenRepository: AuthTokenRepository
  ) {}

  async execute(request: VerifyTokenUseCaseRequest) {
    // E-mail inexistente responde como código inválido, para não revelar a conta.
    const educator = await this.educatorRepository.getByEmail(request.email);
    if (!educator) {
      return failure("INVALID_TOKEN");
    }

    const authToken = await this.authTokenRepository.findByUserId(educator.id);
    if (!authToken) {
      return failure("INVALID_TOKEN");
    }

    const checked = await checkRecoveryCode(
      this.authTokenRepository,
      authToken,
      request.token,
      new Date()
    );
    if (!checked.ok) {
      return failure(checked.error);
    }

    return success({ valid: true });
  }
}
