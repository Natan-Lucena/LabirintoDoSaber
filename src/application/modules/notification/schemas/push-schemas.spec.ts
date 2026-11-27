import { describe, it, expect } from "vitest";
import { NotificationKind } from "../../../../domain/entities/notification";
import { updateNotificationPreferencesSchema } from "./push-schemas";

describe("updateNotificationPreferencesSchema", () => {
  it("should accept every NotificationKind as an optional key", () => {
    const kinds = Object.fromEntries(Object.values(NotificationKind).map((kind) => [kind, false]));

    expect(updateNotificationPreferencesSchema.safeParse({ kinds }).success).toBe(true);
    expect(updateNotificationPreferencesSchema.safeParse({ kinds: {} }).success).toBe(true);
    expect(updateNotificationPreferencesSchema.safeParse({}).success).toBe(true);
  });

  it("should reject unknown kinds, unknown fields and non-boolean values", () => {
    expect(updateNotificationPreferencesSchema.safeParse({ kinds: { OTHER: true } }).success).toBe(false);
    expect(updateNotificationPreferencesSchema.safeParse({ extra: true }).success).toBe(false);
    expect(
      updateNotificationPreferencesSchema.safeParse({ kinds: { PLAN_REVIEW_DUE: "no" } }).success
    ).toBe(false);
    expect(updateNotificationPreferencesSchema.safeParse({ pushEnabled: null }).success).toBe(false);
  });
});
