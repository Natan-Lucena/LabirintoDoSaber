import { success, Uuid } from "@wave-telecom/framework/core";
import {
  MAX_PUSH_TOKENS_PER_EDUCATOR,
  PushPlatform,
  PushToken,
} from "../../../../../domain/entities/push-token";
import { PushTokenRepository } from "../../../../../domain/repositories/push-token-repository";
import { mapPushTokenToResponse } from "../../../../../infraestructure/mappers/map-push";

export interface RegisterPushTokenUseCaseRequest {
  educatorId: Uuid;
  token: string;
  platform: PushPlatform;
  now?: Date;
}

// PU-01: upsert pelo token (o aparelho passa para quem está logado) e no
// máximo 5 por educador, saindo o visto há mais tempo.
export class RegisterPushTokenUseCase {
  constructor(private pushTokenRepository: PushTokenRepository) {}

  async execute(request: RegisterPushTokenUseCaseRequest) {
    const now = request.now ?? new Date();
    const created = PushToken.create({
      token: request.token,
      educatorId: request.educatorId,
      platform: request.platform,
      now,
    });
    if (!created.ok) return created;

    const existing = await this.pushTokenRepository.findByToken(created.value.token);
    const pushToken = existing
      ? existing.seenBy({ educatorId: request.educatorId, platform: request.platform, now })
      : created.value;
    await this.pushTokenRepository.save(pushToken);

    const tokens = await this.pushTokenRepository.listByEducatorIds([request.educatorId]);
    const excess = tokens
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .slice(MAX_PUSH_TOKENS_PER_EDUCATOR);
    if (excess.length > 0) {
      await this.pushTokenRepository.deleteByIds(excess.map((t) => t.id));
    }

    return success(mapPushTokenToResponse(pushToken));
  }
}
