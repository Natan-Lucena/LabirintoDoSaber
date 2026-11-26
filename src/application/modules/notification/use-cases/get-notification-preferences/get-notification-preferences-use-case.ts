import { success, Uuid } from "@wave-telecom/framework/core";
import { NotificationPreferences } from "../../../../../domain/entities/notification-preferences";
import { NotificationPreferencesRepository } from "../../../../../domain/repositories/notification-preferences-repository";
import { mapNotificationPreferencesToResponse } from "../../../../../infraestructure/mappers/map-push";

export class GetNotificationPreferencesUseCase {
  constructor(private preferencesRepository: NotificationPreferencesRepository) {}

  // Sem registro, devolve os padrões sem gravar.
  async execute(request: { educatorId: Uuid }) {
    const preferences =
      (await this.preferencesRepository.findByEducatorId(request.educatorId)) ??
      NotificationPreferences.defaults(request.educatorId);
    return success(mapNotificationPreferencesToResponse(preferences));
  }
}
