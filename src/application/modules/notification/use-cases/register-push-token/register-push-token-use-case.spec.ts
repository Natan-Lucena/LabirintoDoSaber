import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { RegisterPushTokenUseCase } from "./register-push-token-use-case";
import { makePushTokenRepository } from "../push-fixtures";

const NOW = new Date("2026-11-26T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const token = (n: number) => `ExponentPushToken[device-${n}]`;

describe("RegisterPushTokenUseCase (PU-01)", () => {
  const educator = Uuid.random();
  let repository: ReturnType<typeof makePushTokenRepository>;
  let useCase: RegisterPushTokenUseCase;

  beforeEach(() => {
    repository = makePushTokenRepository();
    useCase = new RegisterPushTokenUseCase(repository);
  });

  it("should register a new token and return it", async () => {
    const result = await useCase.execute({
      educatorId: educator,
      token: token(1),
      platform: "android",
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        token: token(1),
        platform: "android",
        createdAt: NOW.toISOString(),
        lastSeenAt: NOW.toISOString(),
      },
    });
    expect(repository.store).toHaveLength(1);
  });

  it("should reject a token outside the Expo format", async () => {
    const result = await useCase.execute({
      educatorId: educator,
      token: "fcm:abc",
      platform: "ios",
      now: NOW,
    });

    expect(result).toEqual({ ok: false, error: "INVALID_PUSH_TOKEN" });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("should upsert the same token without duplicating, refreshing lastSeenAt", async () => {
    await useCase.execute({ educatorId: educator, token: token(1), platform: "android", now: NOW });
    const result = await useCase.execute({
      educatorId: educator,
      token: token(1),
      platform: "android",
      now: at(10),
    });

    expect(repository.store).toHaveLength(1);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        createdAt: NOW.toISOString(),
        lastSeenAt: at(10).toISOString(),
      }),
    });
  });

  it("should move a token registered by another educator to the current one", async () => {
    const other = Uuid.random();
    await useCase.execute({ educatorId: other, token: token(1), platform: "ios", now: NOW });

    await useCase.execute({ educatorId: educator, token: token(1), platform: "ios", now: at(1) });

    expect(repository.store).toHaveLength(1);
    expect(repository.store[0].educatorId.value).toBe(educator.value);
  });

  it("should keep at most 5 tokens per educator, removing the least recently seen", async () => {
    for (let n = 1; n <= 5; n++) {
      await useCase.execute({ educatorId: educator, token: token(n), platform: "android", now: at(n) });
    }
    // O 1 é visto de novo: o mais antigo passa a ser o 2.
    await useCase.execute({ educatorId: educator, token: token(1), platform: "android", now: at(6) });

    await useCase.execute({ educatorId: educator, token: token(6), platform: "android", now: at(7) });

    const tokens = repository.store
      .filter((t) => t.educatorId.value === educator.value)
      .map((t) => t.token)
      .sort();
    expect(tokens).toEqual([token(1), token(3), token(4), token(5), token(6)].sort());
  });

  it("should not count tokens of other educators toward the limit", async () => {
    const other = Uuid.random();
    for (let n = 1; n <= 5; n++) {
      await useCase.execute({ educatorId: other, token: token(n), platform: "android", now: at(n) });
    }

    await useCase.execute({ educatorId: educator, token: token(10), platform: "ios", now: at(10) });

    expect(repository.store).toHaveLength(6);
  });
});
