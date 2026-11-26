import { NotificationPreferences } from "../../domain/entities/notification-preferences";
import { PushToken } from "../../domain/entities/push-token";

export const mapPushTokenToResponse = (pushToken: PushToken) => ({
  token: pushToken.token,
  platform: pushToken.platform,
  createdAt: pushToken.createdAt.toISOString(),
  lastSeenAt: pushToken.lastSeenAt.toISOString(),
});

export const mapNotificationPreferencesToResponse = (preferences: NotificationPreferences) => ({
  pushEnabled: preferences.pushEnabled,
  kinds: preferences.kinds,
});
