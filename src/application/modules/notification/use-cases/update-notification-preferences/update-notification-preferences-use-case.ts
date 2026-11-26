import { success, Uuid } from "@wave-telecom/framework/core";
import {
  NotificationPreferences,
  NotificationPreferencesChanges,
} from "../../../../../domain/entities/notification-preferences";
import { NotificationPreferencesRepository } from "../../../../../domain/repositories/notification-preferences-repository";
import { mapNotificationPreferencesToResponse } from "../../../../../infraestructure/mappers/map-push";

export interface UpdateNotificationPreferencesUseCaseRequest
  extends NotificationPreferencesChanges {
  educatorId: Uuid;
}

// PU-06: parcial sobre o que está salvo (ou sobre os padrões).
export class UpdateNotificationPreferencesUseCase {
  constructor(private preferencesRepository: NotificationPreferencesRepository) {}

  async execute(request: UpdateNotificationPreferencesUseCaseRequest) {
    const current =
      (await this.preferencesRepository.findByEducatorId(request.educatorId)) ??
      NotificationPreferences.defaults(request.educatorId);

    const updated = current.update({ pushEnabled: request.pushEnabled, kinds: request.kinds });
    await this.preferencesRepository.save(updated);

    return success(mapNotificationPreferencesToResponse(updated));
  }
}
