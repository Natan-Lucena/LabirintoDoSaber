import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { SendDailyPushUseCase } from "./send-daily-push-use-case";
import {
  Notification,
  NotificationTargetType,
} from "../../../../../domain/entities/notification";
import { NotificationPreferences } from "../../../../../domain/entities/notification-preferences";
import { PushToken } from "../../../../../domain/entities/push-token";
import {
  PushMessage,
  PushReceiptOutcome,
  PushSender,
  PushTicket,
} from "../../../../../domain/services/push-sender";
import { makeNotificationRepository } from "../test-fixtures";
import {
  makeDispatchRepository,
  makePreferencesRepository,
  makePushTokenRepository,
  makeReceiptRepository,
} from "../push-fixtures";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// 06:00 em São Paulo, horário do cron.
const NOW = new Date("2026-11-26T09:00:00.000Z");
const TODAY = "2026-11-26";
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const okSender = () => {
  const sender = {
    send: vi.fn(
      async (messages: PushMessage[]): Promise<PushTicket[]> =>
        messages.map((m) => ({ status: "ok", receiptId: `receipt:${m.to}` }))
    ),
    getReceipts: vi.fn(async (_ids: string[]): Promise<PushReceiptOutcome[]> => []),
  };
  return sender as typeof sender & PushSender;
};

describe("SendDailyPushUseCase (PU-02 a PU-06)", () => {
  const educatorA = Uuid.random();
  const educatorB = Uuid.random();

  let notifications: ReturnType<typeof makeNotificationRepository>;
  let preferences: ReturnType<typeof makePreferencesRepository>;
  let tokens: ReturnType<typeof makePushTokenRepository>;
  let dispatches: ReturnType<typeof makeDispatchRepository>;
  let receipts: ReturnType<typeof makeReceiptRepository>;
  let sender: ReturnType<typeof okSender>;
  let useCase: SendDailyPushUseCase;

  const appointments = (educatorId: Uuid, count: number, now = NOW) =>
    Notification.appointmentsToday({ educatorId, date: TODAY, count, now });
  const evolution = (educatorId: Uuid, firstName = "Mariazinha", now = NOW) =>
    Notification.evolutionPending({
      educatorId,
      date: TODAY,
      studentId: Uuid.random(),
      firstName,
      sessionId: Uuid.random(),
      now,
    });
  const review = (educatorId: Uuid, firstName = "Joãozinho", now = NOW) =>
    Notification.planReviewDue({
      educatorId,
      date: TODAY,
      studentId: Uuid.random(),
      firstName,
      planId: Uuid.random(),
      nextReviewDate: "2026-11-30",
      now,
    });

  const addToken = (educatorId: Uuid, token: string) => {
    const created = PushToken.create({ token, educatorId, platform: "android", now: ago(DAY) });
    if (!created.ok) throw new Error(created.error);
    tokens.store.push(created.value);
  };

  const sentMessages = () => sender.send.mock.calls.flatMap(([messages]) => messages);

  beforeEach(() => {
    notifications = makeNotificationRepository();
    preferences = makePreferencesRepository();
    tokens = makePushTokenRepository();
    dispatches = makeDispatchRepository();
    receipts = makeReceiptRepository();
    sender = okSender();
    useCase = new SendDailyPushUseCase(
      notifications,
      preferences,
      tokens,
      dispatches,
      receipts,
      sender
    );
    addToken(educatorA, "ExponentPushToken[a-phone]");
    addToken(educatorA, "ExponentPushToken[a-tablet]");
    addToken(educatorB, "ExponentPushToken[b-phone]");
  });

  it("should send one grouped push per educator to each of their devices", async () => {
    notifications.store.push(
      appointments(educatorA, 3),
      evolution(educatorA),
      evolution(educatorA),
      review(educatorB)
    );

    const result = await useCase.execute(NOW);

    expect(result.ok).toBe(true);
    const messages = sentMessages();
    expect(messages).toHaveLength(3);
    const toA = messages.filter((m) => m.to.startsWith("ExponentPushToken[a-"));
    expect(toA.map((m) => m.to).sort()).toEqual([
      "ExponentPushToken[a-phone]",
      "ExponentPushToken[a-tablet]",
    ]);
    for (const message of toA) {
      expect(message.title).toBe("Labirinto do Saber");
      expect(message.body).toBe("Você tem 3 atendimentos hoje · 2 evoluções pendentes");
      expect(message.data).toEqual({
        notificationIds: expect.arrayContaining(
          notifications.store
            .filter((n) => n.educatorId.value === educatorA.value)
            .map((n) => n.id.value)
        ),
      });
      expect((message.data.notificationIds as string[]).length).toBe(3);
    }
    const toB = messages.find((m) => m.to === "ExponentPushToken[b-phone]")!;
    expect(toB.body).toBe("Você tem 1 revisão de plano");
  });

  it("should never put the patient name in the push (BE-PU-02)", async () => {
    notifications.store.push(evolution(educatorA, "Mariazinha"), review(educatorA, "Joãozinho"));
    expect(notifications.store.map((n) => n.body).join(" ")).toContain("Mariazinha");

    await useCase.execute(NOW);

    const text = JSON.stringify(sentMessages());
    expect(text).not.toContain("Mariazinha");
    expect(text).not.toContain("Joãozinho");
  });

  it("should send the target only when there is exactly one notification (PU-04)", async () => {
    const only = review(educatorB);
    notifications.store.push(only, appointments(educatorA, 1), evolution(educatorA));

    await useCase.execute(NOW);

    const toB = sentMessages().find((m) => m.to === "ExponentPushToken[b-phone]")!;
    expect(toB.data).toEqual({
      notificationIds: [only.id.value],
      target: { type: NotificationTargetType.PLAN, id: only.target!.id },
    });
    const toA = sentMessages().find((m) => m.to === "ExponentPushToken[a-phone]")!;
    expect(toA.data).not.toHaveProperty("target");
  });

  it("should not send a second push when the job runs twice on the same day (BE-PU-01)", async () => {
    notifications.store.push(appointments(educatorA, 2));
    await useCase.execute(NOW);
    expect(sentMessages()).toHaveLength(2);

    // Segunda execução no mesmo dia, inclusive com notificação nova.
    notifications.store.push(evolution(educatorA, "Ana", new Date(NOW.getTime() + HOUR)));
    await useCase.execute(new Date(NOW.getTime() + 2 * HOUR));

    expect(sentMessages()).toHaveLength(2);
  });

  it("should send again on the next day", async () => {
    notifications.store.push(appointments(educatorA, 2));
    await useCase.execute(NOW);

    const tomorrow = new Date(NOW.getTime() + DAY);
    notifications.store.push(
      Notification.appointmentsToday({
        educatorId: educatorA,
        date: "2026-11-27",
        count: 1,
        now: tomorrow,
      })
    );
    await useCase.execute(tomorrow);

    expect(sentMessages()).toHaveLength(4);
    expect(sentMessages()[3].body).toBe("Você tem 1 atendimento hoje");
  });

  it("should consider earlier notifications of the same day, but not yesterday's or read ones", async () => {
    // 03:00Z = 00:00 em São Paulo.
    const earlierToday = new Date("2026-11-26T03:30:00.000Z");
    const yesterday = new Date("2026-11-26T02:30:00.000Z");
    notifications.store.push(
      evolution(educatorA, "Ana", earlierToday),
      evolution(educatorA, "Bia", yesterday),
      review(educatorA, "Caio").markRead(NOW),
      appointments(educatorA, 1)
    );

    await useCase.execute(NOW);

    expect(sentMessages()[0].body).toBe("Você tem 1 atendimento hoje · 1 evolução pendente");
  });

  it("should send nothing when push is disabled, keeping the notifications (BE-PU-03)", async () => {
    preferences.store.push(
      NotificationPreferences.defaults(educatorA).update({ pushEnabled: false })
    );
    notifications.store.push(appointments(educatorA, 2), evolution(educatorA));

    await useCase.execute(NOW);

    expect(sentMessages()).toHaveLength(0);
    expect(notifications.store).toHaveLength(2);
    expect(dispatches.claimed.size).toBe(0);
  });

  it("should leave a disabled kind out of the push (PU-06)", async () => {
    preferences.store.push(
      NotificationPreferences.defaults(educatorA).update({
        kinds: { EVOLUTION_PENDING: false },
      })
    );
    const appointment = appointments(educatorA, 2);
    notifications.store.push(appointment, evolution(educatorA), evolution(educatorA));

    await useCase.execute(NOW);

    const message = sentMessages().find((m) => m.to === "ExponentPushToken[a-phone]")!;
    expect(message.body).toBe("Você tem 2 atendimentos hoje");
    expect(message.data).toEqual({
      notificationIds: [appointment.id.value],
      target: { type: NotificationTargetType.AGENDA_DAY, id: TODAY },
    });
    // A lista continua com tudo.
    expect(notifications.store).toHaveLength(3);
  });

  it("should not send when every notification of the educator is of a disabled kind", async () => {
    preferences.store.push(
      NotificationPreferences.defaults(educatorA).update({
        kinds: { EVOLUTION_PENDING: false },
      })
    );
    notifications.store.push(evolution(educatorA));

    await useCase.execute(NOW);

    expect(sender.send).not.toHaveBeenCalled();
    expect(dispatches.claimed.size).toBe(0);
  });

  it("should skip educators without devices and not call Expo when there is nothing", async () => {
    const noDevice = Uuid.random();
    notifications.store.push(appointments(noDevice, 1));

    await useCase.execute(NOW);

    expect(sender.send).not.toHaveBeenCalled();
    expect(dispatches.claimed.size).toBe(0);
  });

  it("should delete a token right away when the ticket says DeviceNotRegistered", async () => {
    sender.send.mockImplementation(async (messages: PushMessage[]) =>
      messages.map((m): PushTicket =>
        m.to === "ExponentPushToken[a-tablet]"
          ? { status: "error", deviceNotRegistered: true }
          : { status: "ok", receiptId: `receipt:${m.to}` }
      )
    );
    notifications.store.push(appointments(educatorA, 1));

    await useCase.execute(NOW);

    expect(tokens.store.map((t) => t.token).sort()).toEqual([
      "ExponentPushToken[a-phone]",
      "ExponentPushToken[b-phone]",
    ]);
    expect(receipts.store).toEqual([
      { receiptId: "receipt:ExponentPushToken[a-phone]", token: "ExponentPushToken[a-phone]", createdAt: NOW },
    ]);
  });

  it("should not check receipts: that is the watchdog's job, inside the 24 h Expo window", async () => {
    receipts.store.push({ receiptId: "pending", token: "ExponentPushToken[a-phone]", createdAt: ago(HOUR) });
    notifications.store.push(appointments(educatorA, 1));

    await useCase.execute(NOW);

    expect(sender.getReceipts).not.toHaveBeenCalled();
    expect(receipts.store.map((r) => r.receiptId)).toContain("pending");
  });

  it("should not break when Expo fails, and free the day for a new attempt (PU-05)", async () => {
    sender.send.mockRejectedValue(new Error("network"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    notifications.store.push(appointments(educatorA, 1));

    const result = await useCase.execute(NOW);

    expect(result).toEqual({ ok: true, value: expect.objectContaining({ educators: 0, released: 1 }) });
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(tokens.store).toHaveLength(3);
    expect(receipts.store).toHaveLength(0);
    expect(dispatches.claimed.size).toBe(0);
    // Loga só o código, sem conteúdo.
    for (const call of log.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("ExponentPushToken");
    }
    log.mockRestore();

    // O cron de novo no mesmo dia tenta outra vez, e só uma vez.
    sender.send.mockImplementation(async (messages: PushMessage[]) =>
      messages.map((m): PushTicket => ({ status: "ok", receiptId: `receipt:${m.to}` }))
    );
    await useCase.execute(new Date(NOW.getTime() + HOUR));
    await useCase.execute(new Date(NOW.getTime() + 2 * HOUR));

    expect(sentMessages()).toHaveLength(4);
  });

  it("should free the day only for the educator whose devices all failed on Expo's side", async () => {
    // A: um aparelho com erro da Expo e o outro morto (ninguém recebeu); B recebeu.
    sender.send.mockImplementation(async (messages: PushMessage[]) =>
      messages.map((m): PushTicket => {
        if (m.to === "ExponentPushToken[a-phone]") return { status: "error", deviceNotRegistered: false };
        if (m.to === "ExponentPushToken[a-tablet]") return { status: "error", deviceNotRegistered: true };
        return { status: "ok", receiptId: `receipt:${m.to}` };
      })
    );
    notifications.store.push(appointments(educatorA, 1), review(educatorB));

    const result = await useCase.execute(NOW);

    expect(result).toEqual({ ok: true, value: expect.objectContaining({ educators: 1, released: 1 }) });
    expect(dispatches.release).toHaveBeenCalledTimes(1);
    expect(dispatches.release).toHaveBeenCalledWith(educatorA, TODAY);
    expect([...dispatches.claimed.keys()]).toEqual([`${educatorB.value}:${TODAY}`]);
  });

  it("should keep the day claimed when at least one device received the push", async () => {
    sender.send.mockImplementation(async (messages: PushMessage[]) =>
      messages.map((m): PushTicket =>
        m.to === "ExponentPushToken[a-phone]"
          ? { status: "error", deviceNotRegistered: false }
          : { status: "ok", receiptId: `receipt:${m.to}` }
      )
    );
    notifications.store.push(appointments(educatorA, 1));

    await useCase.execute(NOW);

    expect(dispatches.release).not.toHaveBeenCalled();
    expect(dispatches.claimed.has(`${educatorA.value}:${TODAY}`)).toBe(true);
  });

  it("should keep the day claimed when the only failures are dead devices", async () => {
    sender.send.mockImplementation(async (messages: PushMessage[]) =>
      messages.map((): PushTicket => ({ status: "error", deviceNotRegistered: true }))
    );
    notifications.store.push(appointments(educatorA, 1));

    await useCase.execute(NOW);

    expect(dispatches.release).not.toHaveBeenCalled();
    expect(tokens.store.map((t) => t.token)).toEqual(["ExponentPushToken[b-phone]"]);
  });
});
