import { Uuid } from "@wave-telecom/framework/core";
import { Notification } from "../entities/notification";

// Posição na lista ordenada por createdAt e depois id, os dois decrescentes.
export interface NotificationCursor {
  createdAt: Date;
  id: string;
}

export interface ListNotificationsParams {
  educatorId: Uuid;
  unreadOnly: boolean;
  limit: number;
  // Devolve só as que vêm depois do cursor.
  after?: NotificationCursor;
}

export interface UnreadCountByStudent {
  // Ausente nas notificações sem aluno (APPOINTMENTS_TODAY).
  studentId?: Uuid;
  count: number;
}

export interface NotificationRepository {
  // Ignora as que já existem com o mesmo dedupeKey. Devolve quantas criou.
  createMany(notifications: Notification[]): Promise<number>;
  // Apaga as criadas antes de `date`. Devolve quantas apagou.
  deleteCreatedBefore(date: Date): Promise<number>;
  save(notification: Notification): Promise<void>;
  findById(id: Uuid): Promise<Notification | null>;
  // Ordenado por createdAt e depois id, mais recente primeiro.
  list(params: ListNotificationsParams): Promise<Notification[]>;
  countUnreadByStudent(educatorId: Uuid): Promise<UnreadCountByStudent[]>;
  // Marca as não lidas do educador. Devolve quantas mudaram.
  markAllRead(educatorId: Uuid, readAt: Date): Promise<number>;
}
