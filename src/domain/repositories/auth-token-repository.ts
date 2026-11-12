import { Uuid } from "@wave-telecom/framework/core";
import { AuthToken } from "../entities/auth-token";

export interface AuthTokenRepository {
  save(authToken: AuthToken): Promise<void>;
  findByUserId(userId: Uuid): Promise<AuthToken | null>;
}
