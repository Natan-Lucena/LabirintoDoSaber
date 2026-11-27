import { Uuid } from "@wave-telecom/framework/core";
import { PushToken } from "../entities/push-token";

export interface PushTokenRepository {
  findByToken(token: string): Promise<PushToken | null>;
  save(pushToken: PushToken): Promise<void>;
  listByEducatorIds(educatorIds: Uuid[]): Promise<PushToken[]>;
  deleteByIds(ids: Uuid[]): Promise<void>;
  // Só apaga se o token for do educador (logout).
  deleteForEducator(token: string, educatorId: Uuid): Promise<void>;
  // Tokens recusados pela Expo (DeviceNotRegistered). Devolve quantos apagou.
  deleteByTokens(tokens: string[]): Promise<number>;
}
