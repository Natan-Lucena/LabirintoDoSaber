import { Uuid } from "@wave-telecom/framework/core";
import { NotificationCursor } from "../../../../domain/repositories/notification-repository";

// O cursor é o par createdAt + id da última notificação da página, em base64url.
export function encodeNotificationCursor(cursor: NotificationCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.id}`).toString(
    "base64url"
  );
}

export function decodeNotificationCursor(value: string): NotificationCursor | undefined {
  const [createdAt, id, ...rest] = Buffer.from(value, "base64url")
    .toString("utf8")
    .split("|");
  if (rest.length > 0 || !id || !Uuid.isValid(id)) return undefined;

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return undefined;

  return { createdAt: date, id };
}
