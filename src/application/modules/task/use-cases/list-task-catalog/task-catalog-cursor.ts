import { Uuid } from "@wave-telecom/framework/core";

export interface TaskCatalogCursor {
  createdAt: Date;
  id: string;
}

// Como nas notificações: createdAt + id da última tarefa da página, em base64url.
export function encodeTaskCatalogCursor(cursor: TaskCatalogCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.id}`).toString("base64url");
}

export function decodeTaskCatalogCursor(value: string): TaskCatalogCursor | undefined {
  const [createdAt, id, ...rest] = Buffer.from(value, "base64url").toString("utf8").split("|");
  if (rest.length > 0 || !id || !Uuid.isValid(id)) return undefined;

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return undefined;

  return { createdAt: date, id };
}
