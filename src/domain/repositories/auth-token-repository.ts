import { Uuid } from "@wave-telecom/framework/core";
import { AuthToken } from "../entities/auth-token";

export interface AuthTokenRepository {
  create(authToken: AuthToken): Promise<AuthToken>;
  findByUserId(userId: Uuid): Promise<AuthToken | null>;
  update(authToken: AuthToken): Promise<void>;
}
