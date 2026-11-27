import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { NotificationKind } from "../../entities/notification";
import { NotificationPreferences } from "../../entities/notification-preferences";

const allOn = {
  APPOINTMENTS_TODAY: true,
  EVOLUTION_PENDING: true,
  PLAN_REVIEW_DUE: true,
  SCALE_DRAFT_STALE: true,
};

describe("NotificationPreferences", () => {
  it("should default to push enabled and every kind on", () => {
    const preferences = NotificationPreferences.defaults(Uuid.random());

    expect(preferences.pushEnabled).toBe(true);
    expect(preferences.kinds).toEqual(allOn);
    for (const kind of Object.values(NotificationKind)) {
      expect(preferences.allowsPush(kind)).toBe(true);
    }
  });

  it("should apply a partial update and keep the rest", () => {
    const preferences = NotificationPreferences.defaults(Uuid.random());

    const updated = preferences.update({
      kinds: { EVOLUTION_PENDING: false },
    });

    expect(updated).not.toBe(preferences);
    expect(updated.id.value).toBe(preferences.id.value);
    expect(updated.pushEnabled).toBe(true);
    expect(updated.kinds).toEqual({ ...allOn, EVOLUTION_PENDING: false });
    expect(updated.allowsPush(NotificationKind.EVOLUTION_PENDING)).toBe(false);
    expect(updated.allowsPush(NotificationKind.APPOINTMENTS_TODAY)).toBe(true);
    // Imutável.
    expect(preferences.kinds).toEqual(allOn);

    const back = updated.update({ pushEnabled: false }).update({
      kinds: { EVOLUTION_PENDING: true },
    });
    expect(back.pushEnabled).toBe(false);
    expect(back.kinds).toEqual(allOn);
  });

  it("should not allow any kind when push is disabled", () => {
    const preferences = NotificationPreferences.defaults(Uuid.random()).update({
      pushEnabled: false,
    });

    for (const kind of Object.values(NotificationKind)) {
      expect(preferences.allowsPush(kind)).toBe(false);
    }
  });
});
