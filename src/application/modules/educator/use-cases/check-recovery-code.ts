import { failure, Result } from "@wave-telecom/framework/core";
import {
  AuthToken,
  AuthTokenCheckError,
} from "../../../../domain/entities/auth-token";
import { AuthTokenRepository } from "../../../../domain/repositories/auth-token-repository";

// Confere o código de recuperação contando a tentativa no banco antes de
// comparar, para que tentativas em paralelo não passem do limite. Usado pelo
// verify-token e pelo update-password.
export async function checkRecoveryCode(
  authTokenRepository: AuthTokenRepository,
  authToken: AuthToken,
  code: string,
  now: Date
): Promise<Result<void, AuthTokenCheckError>> {
  const usable = authToken.ensureUsable(now);
  if (!usable.ok) return usable;

  const counted = await authTokenRepository.registerAttempt(authToken.id);
  if (!counted) {
    // Outra requisição usou o código ou esgotou as tentativas no meio do
    // caminho: relê para responder com o erro certo.
    const current = await authTokenRepository.findByUserId(authToken.userId);
    if (!current) return failure("INVALID_TOKEN");
    const recheck = current.ensureUsable(now);
    return recheck.ok ? failure("TOO_MANY_ATTEMPTS") : recheck;
  }

  return authToken.check(code, now);
}
