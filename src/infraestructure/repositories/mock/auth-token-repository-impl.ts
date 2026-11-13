import { Uuid } from "@wave-telecom/framework/core";
import {
  AUTH_TOKEN_MAX_ATTEMPTS,
  AUTH_TOKEN_SEND_LIMIT,
  AuthToken,
  AuthTokenProps,
  isSendWindowOpen,
} from "../../../domain/entities/auth-token";
import { AuthTokenRepository } from "../../../domain/repositories/auth-token-repository";

// Em memória. Cada método altera o registro de forma síncrona, então as
// condições valem como no banco mesmo com chamadas em paralelo.
export class MockAuthTokenRepository implements AuthTokenRepository {
  private tokens: AuthToken[] = [];

  findByUserId(userId: Uuid): Promise<AuthToken | null> {
    const token = this.tokens.find(
      (token) => token.userId.value === userId.value
    );
    return Promise.resolve(token || null);
  }

  create(authToken: AuthToken): Promise<void> {
    this.tokens.push(authToken);
    return Promise.resolve();
  }

  saveIssued(authToken: AuthToken, now: Date): Promise<boolean> {
    const current = this.get(authToken.id);
    if (!current) return Promise.resolve(false);

    const code = {
      tokenHash: authToken.tokenHash,
      expiresAt: authToken.expiresAt,
      attempts: 0,
      consumedAt: undefined,
    };

    if (isSendWindowOpen(current.sendWindowStart, now)) {
      if (current.sendCount >= AUTH_TOKEN_SEND_LIMIT) {
        return Promise.resolve(false);
      }
      this.replace(current, { ...code, sendCount: current.sendCount + 1 });
      return Promise.resolve(true);
    }

    this.replace(current, { ...code, sendCount: 1, sendWindowStart: now });
    return Promise.resolve(true);
  }

  registerAttempt(authToken: AuthToken): Promise<boolean> {
    const current = this.get(authToken.id);
    if (
      !current ||
      current.tokenHash !== authToken.tokenHash ||
      current.consumedAt ||
      current.attempts >= AUTH_TOKEN_MAX_ATTEMPTS
    ) {
      return Promise.resolve(false);
    }
    this.replace(current, { attempts: current.attempts + 1 });
    return Promise.resolve(true);
  }

  refundAttempt(authToken: AuthToken): Promise<void> {
    const current = this.get(authToken.id);
    if (current && current.tokenHash === authToken.tokenHash && current.attempts > 0) {
      this.replace(current, { attempts: current.attempts - 1 });
    }
    return Promise.resolve();
  }

  consume(authToken: AuthToken, consumedAt: Date): Promise<boolean> {
    const current = this.get(authToken.id);
    if (
      !current ||
      current.tokenHash !== authToken.tokenHash ||
      current.consumedAt
    ) {
      return Promise.resolve(false);
    }
    this.replace(current, { consumedAt });
    return Promise.resolve(true);
  }

  private get(id: Uuid): AuthToken | undefined {
    return this.tokens.find((token) => token.id.value === id.value);
  }

  private replace(current: AuthToken, changes: Partial<AuthTokenProps>) {
    const index = this.tokens.indexOf(current);
    this.tokens[index] = AuthToken.fromPersistence({
      id: current.id,
      userId: current.userId,
      tokenHash: current.tokenHash,
      expiresAt: current.expiresAt,
      attempts: current.attempts,
      consumedAt: current.consumedAt,
      sendCount: current.sendCount,
      sendWindowStart: current.sendWindowStart,
      ...changes,
    });
  }
}
