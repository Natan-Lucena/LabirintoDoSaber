import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { isExpoPushToken, PushToken } from "../../entities/push-token";

const NOW = new Date("2026-11-26T12:00:00.000Z");

describe("PushToken", () => {
  it("should accept both Expo token formats", () => {
    expect(isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
  });

  it.each([
    "",
    "xxxxxxxxxxxxxxxxxxxxxx",
    "ExponentPushToken[]",
    "ExponentPushToken[abc",
    "ExponentPushToken[a b]",
    "FcmToken[abc]",
    " ExponentPushToken[abc]x",
    `ExponentPushToken[${"a".repeat(300)}]`,
  ])("should reject %j", (token) => {
    expect(isExpoPushToken(token)).toBe(false);
    expect(
      PushToken.create({ token, educatorId: Uuid.random(), platform: "android", now: NOW })
    ).toEqual({ ok: false, error: "INVALID_PUSH_TOKEN" });
  });

  it("should create with createdAt and lastSeenAt equal to now", () => {
    const educatorId = Uuid.random();
    const result = PushToken.create({
      token: " ExponentPushToken[abc123] ",
      educatorId,
      platform: "ios",
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.token).toBe("ExponentPushToken[abc123]");
    expect(result.value.educatorId.value).toBe(educatorId.value);
    expect(result.value.platform).toBe("ios");
    expect(result.value.createdAt).toEqual(NOW);
    expect(result.value.lastSeenAt).toEqual(NOW);
  });

  it("should move the token to the current educator, keeping id and createdAt", () => {
    const created = PushToken.create({
      token: "ExpoPushToken[abc]",
      educatorId: Uuid.random(),
      platform: "android",
      now: NOW,
    });
    if (!created.ok) throw new Error(created.error);
    const other = Uuid.random();
    const later = new Date(NOW.getTime() + 1000);

    const seen = created.value.seenBy({ educatorId: other, platform: "ios", now: later });

    expect(seen).not.toBe(created.value);
    expect(seen.id.value).toBe(created.value.id.value);
    expect(seen.educatorId.value).toBe(other.value);
    expect(seen.platform).toBe("ios");
    expect(seen.createdAt).toEqual(NOW);
    expect(seen.lastSeenAt).toEqual(later);
    // Imutável.
    expect(created.value.lastSeenAt).toEqual(NOW);
  });
});
