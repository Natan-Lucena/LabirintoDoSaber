import {
  Notification,
  NotificationKind,
  NotificationTarget,
} from "../entities/notification";

export const DAILY_PUSH_TITLE = "Labirinto do Saber";

export interface DailyPushData {
  notificationIds: string[];
  // Só quando o push é de uma notificação (PU-04).
  target?: NotificationTarget;
}

export interface DailyPush {
  title: string;
  body: string;
  data: DailyPushData;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

// Ordem fixa das partes do texto.
const PHRASES: [NotificationKind, (count: number) => string][] = [
  [NotificationKind.APPOINTMENTS_TODAY, (c) => `${plural(c, "atendimento", "atendimentos")} hoje`],
  [NotificationKind.EVOLUTION_PENDING, (c) => plural(c, "evolução pendente", "evoluções pendentes")],
  [NotificationKind.PLAN_REVIEW_DUE, (c) => plural(c, "revisão de plano", "revisões de plano")],
  [NotificationKind.SCALE_DRAFT_STALE, (c) => plural(c, "escala em rascunho", "escalas em rascunho")],
];

// Push diário do educador (PU-03, PU-04): só contagens por tipo, nada do texto
// das notificações (que pode ter o nome do paciente).
export function buildDailyPush(notifications: Notification[]): DailyPush {
  const counts = new Map<NotificationKind, number>();
  for (const notification of notifications) {
    // APPOINTMENTS_TODAY é uma por dia e carrega a quantidade.
    const amount =
      notification.kind === NotificationKind.APPOINTMENTS_TODAY ? notification.count ?? 1 : 1;
    counts.set(notification.kind, (counts.get(notification.kind) ?? 0) + amount);
  }

  const parts = PHRASES.filter(([kind]) => counts.has(kind)).map(([kind, phrase]) =>
    phrase(counts.get(kind)!)
  );

  const data: DailyPushData = { notificationIds: notifications.map((n) => n.id.value) };
  const target = notifications.length === 1 ? notifications[0].target : undefined;
  if (target) data.target = { type: target.type, id: target.id };

  return { title: DAILY_PUSH_TITLE, body: `Você tem ${parts.join(" · ")}`, data };
}
