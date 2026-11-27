import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UnregisterPushTokenUseCase } from "./unregister-push-token-use-case";
import { makePushTokenRepository } from "../push-fixtures";
import { PushToken } from "../../../../../domain/entities/push-token";

const NOW = new Date("2026-11-26T12:00:00.000Z");

const pushToken = (educatorId: Uuid, token: string) => {
  const created = PushToken.create({ token, educatorId, platform: "android", now: NOW });
  if (!created.ok) throw new Error(created.error);
  return created.value;
};

describe("UnregisterPushTokenUseCase (PU-05, logout)", () => {
  const educator = Uuid.random();
  const other = Uuid.random();
  let repository: ReturnType<typeof makePushTokenRepository>;
  let useCase: UnregisterPushTokenUseCase;

  beforeEach(() => {
    repository = makePushTokenRepository();
    repository.store.push(
      pushToken(educator, "ExponentPushToken[mine]"),
      pushToken(other, "ExponentPushToken[theirs]")
    );
    useCase = new UnregisterPushTokenUseCase(repository);
  });

  it("should delete the educator's own token", async () => {
    const result = await useCase.execute({ educatorId: educator, token: "ExponentPushToken[mine]" });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(repository.store.map((t) => t.token)).toEqual(["ExponentPushToken[theirs]"]);
  });

  it("should not delete a token of another educator", async () => {
    const result = await useCase.execute({ educatorId: educator, token: "ExponentPushToken[theirs]" });

    expect(result.ok).toBe(true);
    expect(repository.store).toHaveLength(2);
  });

  it("should be idempotent for an unknown token", async () => {
    await useCase.execute({ educatorId: educator, token: "ExponentPushToken[mine]" });
    const result = await useCase.execute({ educatorId: educator, token: "ExponentPushToken[mine]" });

    expect(result.ok).toBe(true);
    expect(repository.store).toHaveLength(1);
  });
});
