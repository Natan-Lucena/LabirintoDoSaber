import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Notification,
  NotificationTargetType,
} from "../../entities/notification";
import { buildDailyPush, DAILY_PUSH_TITLE } from "../../services/daily-push";

const educatorId = Uuid.random();
const date = "2026-11-26";

const appointments = (count: number) =>
  Notification.appointmentsToday({ educatorId, date, count });
const evolution = (firstName = "Ana") =>
  Notification.evolutionPending({
    educatorId,
    date,
    studentId: Uuid.random(),
    firstName,
    sessionId: Uuid.random(),
  });
const review = (firstName = "Bruno") =>
  Notification.planReviewDue({
    educatorId,
    date,
    studentId: Uuid.random(),
    firstName,
    planId: Uuid.random(),
    nextReviewDate: "2026-11-30",
  });
const draft = (firstName = "Carla") =>
  Notification.scaleDraftStale({
    educatorId,
    date,
    studentId: Uuid.random(),
    firstName,
    applicationId: Uuid.random(),
    templateName: "SNAP-IV",
    days: 8,
    updatedAt: new Date("2026-11-04T12:00:00.000Z"),
  });

describe("buildDailyPush (PU-03, PU-04)", () => {
  it("should count by kind in a single generic text", () => {
    const evolutions = [evolution(), evolution()];
    const push = buildDailyPush([appointments(3), ...evolutions]);

    expect(push.title).toBe(DAILY_PUSH_TITLE);
    expect(push.title).toBe("Labirinto do Saber");
    expect(push.body).toBe("Você tem 3 atendimentos hoje · 2 evoluções pendentes");
  });

  it("should use singular forms for one of each kind", () => {
    const push = buildDailyPush([draft(), review(), evolution(), appointments(1)]);

    expect(push.body).toBe(
      "Você tem 1 atendimento hoje · 1 evolução pendente · 1 revisão de plano · 1 escala em rascunho"
    );
  });

  it("should use plural forms for many of each kind", () => {
    const push = buildDailyPush([review(), review(), draft(), draft(), draft()]);

    expect(push.body).toBe("Você tem 2 revisões de plano · 3 escalas em rascunho");
  });

  it("should not leak the patient name or details (BE-PU-02)", () => {
    const items = [
      evolution("Mariazinha"),
      review("Joãozinho"),
      draft("Pedrinho"),
    ];
    // A notificação da lista tem o nome; o push não.
    expect(items.map((n) => n.body).join(" ")).toContain("Mariazinha");

    const push = buildDailyPush(items);
    const text = JSON.stringify(push);

    for (const name of ["Mariazinha", "Joãozinho", "Pedrinho", "SNAP-IV"]) {
      expect(text).not.toContain(name);
    }
  });

  it("should carry the target only when there is exactly one notification", () => {
    const one = evolution();
    const single = buildDailyPush([one]);

    expect(single.data).toEqual({
      notificationIds: [one.id.value],
      target: { type: NotificationTargetType.SESSION, id: one.target!.id },
    });

    const two = [appointments(2), evolution()];
    const many = buildDailyPush(two);

    expect(many.data).toEqual({ notificationIds: two.map((n) => n.id.value) });
    expect(many.data).not.toHaveProperty("target");
  });
});
