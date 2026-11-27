import { Uuid } from "@wave-telecom/framework/core";
import { NotificationPreferences } from "../entities/notification-preferences";

// Ausência de registro = preferências padrão.
export interface NotificationPreferencesRepository {
  findByEducatorId(educatorId: Uuid): Promise<NotificationPreferences | null>;
  listByEducatorIds(educatorIds: Uuid[]): Promise<NotificationPreferences[]>;
  save(preferences: NotificationPreferences): Promise<void>;
}
