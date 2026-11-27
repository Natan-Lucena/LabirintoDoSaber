import { describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { PushTokenRepositoryImpl } from "./push-token-repository-impl";
import { NotificationPreferencesRepositoryImpl } from "./notification-preferences-repository-impl";
import { PushToken } from "../../../domain/entities/push-token";
import { NotificationPreferences } from "../../../domain/entities/notification-preferences";

// Upsert pela chave única, não pelo id: duas requisições em paralelo com o
// mesmo token (ou o mesmo educador) não caem em P2002 → 500.
describe("Push repositories upsert by unique key", () => {
  it("should upsert the push token by token, keeping token and createdAt on update", async () => {
    const upsert = vi.fn();
    const repository = new PushTokenRepositoryImpl({ pushToken: { upsert } } as unknown as PrismaClient);
    const created = PushToken.create({
      token: "ExponentPushToken[abc]",
      educatorId: Uuid.random(),
      platform: "android",
    });
    if (!created.ok) throw new Error(created.error);

    await repository.save(created.value);

    const args = upsert.mock.calls[0][0];
    expect(args.where).toEqual({ token: "ExponentPushToken[abc]" });
    expect(args.update).not.toHaveProperty("token");
    expect(args.update).not.toHaveProperty("createdAt");
    expect(args.update).toEqual(
      expect.objectContaining({
        educatorId: created.value.educatorId.value,
        platform: "android",
        lastSeenAt: created.value.lastSeenAt,
      })
    );
    expect(args.create).toEqual(
      expect.objectContaining({ id: created.value.id.value, token: "ExponentPushToken[abc]" })
    );
  });

  it("should upsert the preferences by educatorId", async () => {
    const upsert = vi.fn();
    const repository = new NotificationPreferencesRepositoryImpl({
      notificationPreferences: { upsert },
    } as unknown as PrismaClient);
    const educatorId = Uuid.random();
    const preferences = NotificationPreferences.defaults(educatorId).update({
      kinds: { PLAN_REVIEW_DUE: false },
    });

    await repository.save(preferences);

    const args = upsert.mock.calls[0][0];
    expect(args.where).toEqual({ educatorId: educatorId.value });
    expect(args.update).not.toHaveProperty("educatorId");
    expect(args.update.disabledKinds).toEqual({ set: ["PLAN_REVIEW_DUE"] });
    expect(args.create).toEqual(
      expect.objectContaining({ id: preferences.id.value, educatorId: educatorId.value })
    );
  });
});
