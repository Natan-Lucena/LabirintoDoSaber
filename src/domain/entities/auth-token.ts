import { Uuid } from "@wave-telecom/framework/core";

export class AuthToken {
  private constructor(public token: string, public readonly userId: Uuid) {}

  static create(userId: Uuid) {
    const token = Math.random().toString(36).substring(2, 8);
    return new AuthToken(token, userId);
  }

  generateNewToken() {
    const newToken = Math.random().toString(36).substring(2, 8);
    this.token = newToken;
  }
}
