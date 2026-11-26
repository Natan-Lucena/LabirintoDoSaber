import { success, Uuid } from "@wave-telecom/framework/core";
import { PushTokenRepository } from "../../../../../domain/repositories/push-token-repository";

export interface UnregisterPushTokenUseCaseRequest {
  educatorId: Uuid;
  token: string;
}

// Logout (PU-05): apaga o token só se for do educador. Idempotente.
export class UnregisterPushTokenUseCase {
  constructor(private pushTokenRepository: PushTokenRepository) {}

  async execute(request: UnregisterPushTokenUseCaseRequest) {
    await this.pushTokenRepository.deleteForEducator(request.token.trim(), request.educatorId);
    return success(undefined);
  }
}
