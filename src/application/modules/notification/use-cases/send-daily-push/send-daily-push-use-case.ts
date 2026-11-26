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
  PushReceiptOutcome,
  PushSender,
  PushTicket,
} from "../../../../../domain/services/push-sender";
import {
  startOfDayInSaoPaulo,
  todayInSaoPaulo,
} from "../../../../../domain/utils/date-only";

const DAY_MS = 24 * 60 * 60 * 1000;
// A Expo guarda os recibos por um dia; o que passar disso não tem mais resposta.
const RECEIPT_RETENTION_MS = 2 * DAY_MS;
const DISPATCH_RETENTION_MS = 7 * DAY_MS;

// Push diário (PU-02 a PU-05), depois de gerar as notificações do dia: no
// máximo um por educador por dia, só com os kinds ligados e sem nome de
// paciente. Falha da Expo não interrompe o cron.
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

    // Recibos dos envios anteriores primeiro: o token morto não recebe hoje.
    let tokensRemoved = await this.checkReceipts(now);
    await this.dispatchRepository.deleteCreatedBefore(
      new Date(now.getTime() - DISPATCH_RETENTION_MS)
    );

    // As do dia, inclusive as criadas por outra execução mais cedo.
    const notifications = await this.notificationRepository.listUnreadCreatedSince(
      startOfDayInSaoPaulo(today)
    );
    const byEducator = groupBy(notifications, (n) => n.educatorId.value);
    if (byEducator.size === 0) return success({ educators: 0, messages: 0, tokensRemoved });

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
      }
    }
    if (messages.length === 0) return success({ educators, messages: 0, tokensRemoved });

    const tickets = await this.send(messages);

    const deadTokens: string[] = [];
    const receipts: PendingPushReceipt[] = [];
    tickets.forEach((ticket, index) => {
      const token = messages[index].to;
      if (ticket.status === "ok") receipts.push({ receiptId: ticket.receiptId, token, createdAt: now });
      else if (ticket.deviceNotRegistered) deadTokens.push(token);
    });
    if (deadTokens.length > 0) {
      tokensRemoved += await this.pushTokenRepository.deleteByTokens(deadTokens);
    }
    if (receipts.length > 0) await this.receiptRepository.saveMany(receipts);

    return success({ educators, messages: messages.length, tokensRemoved });
  }

  // PU-05: recibos com DeviceNotRegistered apagam o token. Os que a Expo ainda
  // não tem ficam para a próxima execução, até a retenção.
  private async checkReceipts(now: Date): Promise<number> {
    await this.receiptRepository.deleteCreatedBefore(new Date(now.getTime() - RECEIPT_RETENTION_MS));
    const pending = await this.receiptRepository.listAll();
    if (pending.length === 0) return 0;

    let outcomes: PushReceiptOutcome[];
    try {
      outcomes = await this.pushSender.getReceipts(pending.map((r) => r.receiptId));
    } catch {
      console.error("PUSH_RECEIPTS_FAILED");
      return 0;
    }

    const tokenByReceipt = new Map(pending.map((r) => [r.receiptId, r.token]));
    const deadTokens = outcomes
      .filter((outcome) => outcome.deviceNotRegistered)
      .flatMap((outcome) => tokenByReceipt.get(outcome.receiptId) ?? []);

    const removed = deadTokens.length
      ? await this.pushTokenRepository.deleteByTokens([...new Set(deadTokens)])
      : 0;
    const checked = outcomes.map((outcome) => outcome.receiptId);
    if (checked.length > 0) await this.receiptRepository.deleteByIds(checked);
    return removed;
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
