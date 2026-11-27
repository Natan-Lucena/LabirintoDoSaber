import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { CheckPushReceiptsUseCase } from "./check-push-receipts-use-case";
import { PushToken } from "../../../../../domain/entities/push-token";
import { PushReceiptOutcome, PushSender } from "../../../../../domain/services/push-sender";
import { makePushTokenRepository, makeReceiptRepository } from "../push-fixtures";

const HOUR = 60 * 60 * 1000;
// 05:00 UTC, horário do watchdog: ~20 h depois do push das 09:00 UTC.
const NOW = new Date("2026-11-27T05:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("CheckPushReceiptsUseCase (PU-05, BE-PU-04)", () => {
  let tokens: ReturnType<typeof makePushTokenRepository>;
  let receipts: ReturnType<typeof makeReceiptRepository>;
  let sender: { send: ReturnType<typeof vi.fn>; getReceipts: ReturnType<typeof vi.fn> };
  let useCase: CheckPushReceiptsUseCase;

  const addToken = (token: string) => {
    const created = PushToken.create({ token, educatorId: Uuid.random(), platform: "ios", now: ago(48 * HOUR) });
    if (!created.ok) throw new Error(created.error);
    tokens.store.push(created.value);
  };

  beforeEach(() => {
    tokens = makePushTokenRepository();
    receipts = makeReceiptRepository();
    sender = { send: vi.fn(), getReceipts: vi.fn(async (): Promise<PushReceiptOutcome[]> => []) };
    useCase = new CheckPushReceiptsUseCase(receipts, tokens, sender as unknown as PushSender);
    addToken("ExponentPushToken[phone]");
    addToken("ExponentPushToken[tablet]");
  });

  it("should delete the tokens with DeviceNotRegistered and drop the checked receipts", async () => {
    receipts.store.push(
      { receiptId: "r-phone", token: "ExponentPushToken[phone]", createdAt: ago(20 * HOUR) },
      { receiptId: "r-tablet", token: "ExponentPushToken[tablet]", createdAt: ago(20 * HOUR) }
    );
    sender.getReceipts.mockResolvedValue([
      { receiptId: "r-phone", status: "ok", deviceNotRegistered: false },
      { receiptId: "r-tablet", status: "error", deviceNotRegistered: true },
    ]);

    const result = await useCase.execute(NOW);

    expect(sender.getReceipts).toHaveBeenCalledWith(["r-phone", "r-tablet"]);
    expect(result).toEqual({ ok: true, value: { checked: 2, tokensRemoved: 1 } });
    expect(tokens.store.map((t) => t.token)).toEqual(["ExponentPushToken[phone]"]);
    expect(receipts.store).toHaveLength(0);
  });

  it("should keep receipts not ready yet and drop the ones past the 24 h Expo window", async () => {
    receipts.store.push(
      { receiptId: "fresh", token: "ExponentPushToken[phone]", createdAt: ago(HOUR) },
      { receiptId: "expired", token: "ExponentPushToken[tablet]", createdAt: ago(25 * HOUR) }
    );

    await useCase.execute(NOW);

    expect(sender.getReceipts).toHaveBeenCalledWith(["fresh"]);
    expect(receipts.store.map((r) => r.receiptId)).toEqual(["fresh"]);
    expect(tokens.store).toHaveLength(2);
  });

  it("should not call Expo when there is no pending receipt", async () => {
    expect(await useCase.execute(NOW)).toEqual({ ok: true, value: { checked: 0, tokensRemoved: 0 } });
    expect(sender.getReceipts).not.toHaveBeenCalled();
  });

  it("should never throw, so the watchdog keeps working", async () => {
    receipts.store.push({ receiptId: "pending", token: "ExponentPushToken[phone]", createdAt: ago(HOUR) });
    sender.getReceipts.mockRejectedValue(new Error("network"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await useCase.execute(NOW);

    expect(result).toEqual({ ok: true, value: { checked: 0, tokensRemoved: 0 } });
    expect(receipts.store.map((r) => r.receiptId)).toEqual(["pending"]);
    expect(tokens.store).toHaveLength(2);
    for (const call of log.mock.calls) expect(JSON.stringify(call)).not.toContain("ExponentPushToken");

    receipts.listAll.mockRejectedValueOnce(new Error("db down"));
    await expect(useCase.execute(NOW)).resolves.toEqual({
      ok: true,
      value: { checked: 0, tokensRemoved: 0 },
    });
    log.mockRestore();
  });
});
