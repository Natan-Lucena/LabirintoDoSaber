import { Notification } from "../../domain/entities/notification";

export function mapNotificationToResponse(notification: Notification) {
  return {
    id: notification.id.value,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    target: notification.target
      ? { type: notification.target.type, id: notification.target.id }
      : undefined,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
  };
}
