import { Uuid } from "@wave-telecom/framework/core";
import { AuthToken } from "../../../domain/entities/auth-token";
import { AuthTokenRepository } from "../../../domain/repositories/auth-token-repository";

export class MockAuthTokenRepository implements AuthTokenRepository {
  private tokens: AuthToken[] = [];

  create(token: AuthToken): Promise<AuthToken> {
    this.tokens.push(token);
    return Promise.resolve(token);
  }
  findByUserId(userId: Uuid): Promise<AuthToken | null> {
    const token = this.tokens.find((token) => token.userId === userId);
    return Promise.resolve(token || null);
  }
  update(authToken: AuthToken): Promise<void> {
    const index = this.tokens.findIndex(
      (token) => token.userId === authToken.userId
    );
    if (index !== -1) {
      this.tokens[index] = authToken;
    }
    return Promise.resolve();
  }
}
