import { Uuid } from "@wave-telecom/framework/core";
import { AuthToken } from "../../../domain/entities/auth-token";
import { AuthTokenRepository } from "../../../domain/repositories/auth-token-repository";

export class MockAuthTokenRepository implements AuthTokenRepository {
  private tokens: AuthToken[] = [];

  save(authToken: AuthToken): Promise<void> {
    const index = this.tokens.findIndex(
      (token) => token.id.value === authToken.id.value
    );
    if (index === -1) {
      this.tokens.push(authToken);
    } else {
      this.tokens[index] = authToken;
    }
    return Promise.resolve();
  }

  findByUserId(userId: Uuid): Promise<AuthToken | null> {
    const token = this.tokens.find(
      (token) => token.userId.value === userId.value
    );
    return Promise.resolve(token || null);
  }
}
