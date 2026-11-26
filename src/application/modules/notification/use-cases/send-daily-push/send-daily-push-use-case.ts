import { success, Uuid } from "@wave-telecom/framework/core";
import { NotificationPreferences } from "../../../../../domain/entities/notification-preferences";
import { PushToken } from "../../../../../domain/entities/push-token";
import { NotificationPreferencesRepository } from "../../../../../domain/repositories/notification-preferences-repository";
import { NotificationRepository } from "../../../../../domain/repositories/notification-repository";
import { PushDispatchRepository } from "../../../../../domain/repositories/push-dispatch-repository";
import {
  PendingPushReceipt,
  PushReceiptRepository,
} from "../../../../../domain/repositories/push-receipt-repository";
import { PushTokenRepository } from "../../../../../domain/repositories/push-token-repository";
import { buildDailyPush } from "../../../../../domain/services/daily-push";
import {
  PushMessage,
  PushSender,
  PushTicket,
} from "../../../../../domain/services/push-sender";
import {
  startOfDayInSaoPaulo,
  todayInSaoPaulo,
} from "../../../../../domain/utils/date-only";

const DAY_MS = 24 * 60 * 60 * 1000;
const DISPATCH_RETENTION_MS = 7 * DAY_MS;

// Push diário (PU-02 a PU-05), depois de gerar as notificações do dia: no
// máximo um por educador por dia, só com os kinds ligados e sem nome de
// paciente. Falha da Expo não interrompe o cron. Os recibos são conferidos no
// cron do watchdog (CheckPushReceiptsUseCase), dentro da janela de 24 h da Expo.
export class SendDailyPushUseCase {
  constructor(
    private notificationRepository: NotificationRepository,
    private preferencesRepository: NotificationPreferencesRepository,
    private pushTokenRepository: PushTokenRepository,
    private dispatchRepository: PushDispatchRepository,
    private receiptRepository: PushReceiptRepository,
    private pushSender: PushSender
  ) {}

  async execute(now: Date = new Date()) {
    const today = todayInSaoPaulo(now);

    let tokensRemoved = 0;
    await this.dispatchRepository.deleteCreatedBefore(
      new Date(now.getTime() - DISPATCH_RETENTION_MS)
    );

    // As do dia, inclusive as criadas por outra execução mais cedo.
    const notifications = await this.notificationRepository.listUnreadCreatedSince(
      startOfDayInSaoPaulo(today)
    );
    const byEducator = groupBy(notifications, (n) => n.educatorId.value);
    if (byEducator.size === 0) {
      return success({ educators: 0, messages: 0, tokensRemoved, released: 0 });
    }

    const educatorIds = [...byEducator.keys()].map((id) => new Uuid(id));
    const preferences = new Map(
      (await this.preferencesRepository.listByEducatorIds(educatorIds)).map((p) => [
        p.educatorId.value,
        p,
      ])
    );
    const tokens = groupBy(
      await this.pushTokenRepository.listByEducatorIds(educatorIds),
      (t: PushToken) => t.educatorId.value
    );

    const messages: PushMessage[] = [];
    // Educador de cada mensagem, para liberar o dia se o envio falhar.
    const educatorOf: Uuid[] = [];
    let educators = 0;
    for (const educatorId of educatorIds) {
      const devices = tokens.get(educatorId.value);
      if (!devices?.length) continue;

      const settings =
        preferences.get(educatorId.value) ?? NotificationPreferences.defaults(educatorId);
      const items = byEducator.get(educatorId.value)!.filter((n) => settings.allowsPush(n.kind));
      if (items.length === 0) continue;

      // BE-PU-01: o registro do dia é gravado antes do envio.
      if (!(await this.dispatchRepository.claim(educatorId, today, now))) continue;

      const push = buildDailyPush(items);
      educators++;
      for (const device of devices) {
        messages.push({ to: device.token, title: push.title, body: push.body, data: { ...push.data } });
        educatorOf.push(educatorId);
      }
    }
    if (messages.length === 0) {
      return success({ educators, messages: 0, tokensRemoved, released: 0 });
    }

    const tickets = await this.send(messages);

    const deadTokens: string[] = [];
    const receipts: PendingPushReceipt[] = [];
    const delivered = new Set<string>();
    const failed = new Map<string, Uuid>();
    messages.forEach((message, index) => {
      // Sem ticket (exceção no envio) conta como falha da Expo.
      const ticket = tickets[index] ?? { status: "error", deviceNotRegistered: false };
      const educatorId = educatorOf[index];
      if (ticket.status === "ok") {
        delivered.add(educatorId.value);
        receipts.push({ receiptId: ticket.receiptId, token: message.to, createdAt: now });
      } else if (ticket.deviceNotRegistered) {
        deadTokens.push(message.to);
      } else {
        failed.set(educatorId.value, educatorId);
      }
    });
    if (deadTokens.length > 0) {
      tokensRemoved += await this.pushTokenRepository.deleteByTokens(deadTokens);
    }
    if (receipts.length > 0) await this.receiptRepository.saveMany(receipts);

    // Nenhum aparelho recebeu por falha da Expo (rede, 5xx): libera o dia para
    // que uma nova execução do cron tente de novo.
    let released = 0;
    for (const [key, educatorId] of failed) {
      if (delivered.has(key)) continue;
      await this.dispatchRepository.release(educatorId, today);
      released++;
    }

    return success({ educators: educators - released, messages: messages.length, tokensRemoved, released });
  }

  private async send(messages: PushMessage[]): Promise<PushTicket[]> {
    try {
      return await this.pushSender.send(messages);
    } catch {
      console.error("PUSH_SEND_FAILED");
      return [];
    }
  }
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    const group = groups.get(value);
    if (group) group.push(item);
    else groups.set(value, [item]);
  }
  return groups;
}
