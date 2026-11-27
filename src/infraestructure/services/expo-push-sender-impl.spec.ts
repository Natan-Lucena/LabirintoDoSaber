import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExpoPushSenderImpl } from "./expo-push-sender-impl";
import { PushMessage } from "../../domain/services/push-sender";

const message = (n: number): PushMessage => ({
  to: `ExponentPushToken[device-${n}]`,
  title: "Labirinto do Saber",
  body: "Você tem 1 atendimento hoje",
  data: { notificationIds: [`n-${n}`] },
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("ExpoPushSenderImpl", () => {
  const fetchMock = vi.fn();
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("EXPO_ACCESS_TOKEN", "segredo");
    log = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  it("should post to the Expo push API with the access token and map the tickets", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          { status: "ok", id: "receipt-1" },
          {
            status: "error",
            message: "not registered",
            details: { error: "DeviceNotRegistered" },
          },
          { status: "error", message: "too big", details: { error: "MessageTooBig" } },
        ],
      })
    );

    const tickets = await new ExpoPushSenderImpl().send([message(1), message(2), message(3)]);

    expect(tickets).toEqual([
      { status: "ok", receiptId: "receipt-1" },
      { status: "error", deviceNotRegistered: true },
      { status: "error", deviceNotRegistered: false },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/send");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer segredo");
    const body = JSON.parse(init.body);
    expect(body[0]).toEqual(expect.objectContaining({ ...message(1) }));
  });

  it("should omit the Authorization header when there is no access token", async () => {
    vi.stubEnv("EXPO_ACCESS_TOKEN", "");
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [{ status: "ok", id: "r" }] }));

    await new ExpoPushSenderImpl().send([message(1)]);

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });

  it("should send in batches of at most 100 messages", async () => {
    fetchMock.mockImplementation(async (_url: string, init: any) =>
      jsonResponse({
        data: JSON.parse(init.body).map((_: unknown, i: number) => ({ status: "ok", id: `r${i}` })),
      })
    );
    const messages = Array.from({ length: 250 }, (_, n) => message(n));

    const tickets = await new ExpoPushSenderImpl().send(messages);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).length)).toEqual([
      100, 100, 50,
    ]);
    expect(tickets).toHaveLength(250);
  });

  it("should turn a failed batch into error tickets and log only the status", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ errors: [{ code: "PUSH_TOO_MANY" }] }, 429))
      .mockRejectedValueOnce(new Error("ExponentPushToken[device-1] network"));

    const sender = new ExpoPushSenderImpl();
    const failed = await sender.send([message(1)]);
    const offline = await sender.send([message(1)]);

    expect(failed).toEqual([{ status: "error", deviceNotRegistered: false }]);
    expect(offline).toEqual([{ status: "error", deviceNotRegistered: false }]);
    expect(log).toHaveBeenCalled();
    for (const call of log.mock.calls) {
      const text = JSON.stringify(call);
      expect(text).not.toContain("ExponentPushToken");
      expect(text).not.toContain("atendimento");
    }
  });

  it("should give up after 10 s and treat the timeout as a network failure", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockImplementation(
      (_url: string, init: any) =>
        new Promise((_, reject) => {
          // Como o fetch: rejeita com o motivo do sinal quando ele aborta.
          if (init.signal.aborted) return reject(init.signal.reason);
          init.signal.addEventListener("abort", () => reject(init.signal.reason));
        })
    );
    // Sinal já abortado no lugar do de 10 s, para não esperar no teste.
    timeout.mockImplementation(() => AbortSignal.abort(new DOMException("timeout", "TimeoutError")));

    const sender = new ExpoPushSenderImpl();
    const tickets = await sender.send([message(1)]);
    const receipts = await sender.getReceipts(["a"]);

    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(fetchMock.mock.calls.every(([, init]) => init.signal instanceof AbortSignal)).toBe(true);
    expect(tickets).toEqual([{ status: "error", deviceNotRegistered: false }]);
    expect(receipts).toEqual([]);
    expect(log).toHaveBeenCalledWith("EXPO_PUSH_SEND_FAILED", { status: "NETWORK" });
    expect(log).toHaveBeenCalledWith("EXPO_PUSH_RECEIPTS_FAILED", { status: "NETWORK" });
    timeout.mockRestore();
  });

  it("should fetch the receipts and report DeviceNotRegistered", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          a: { status: "ok" },
          b: { status: "error", message: "x", details: { error: "DeviceNotRegistered" } },
        },
      })
    );

    const outcomes = await new ExpoPushSenderImpl().getReceipts(["a", "b", "not-ready"]);

    expect(outcomes).toEqual([
      { receiptId: "a", status: "ok", deviceNotRegistered: false },
      { receiptId: "b", status: "error", deviceNotRegistered: true },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://exp.host/--/api/v2/push/getReceipts");
    expect(JSON.parse(init.body)).toEqual({ ids: ["a", "b", "not-ready"] });
  });

  it("should return no receipt when Expo fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

    expect(await new ExpoPushSenderImpl().getReceipts(["a"])).toEqual([]);
    expect(await new ExpoPushSenderImpl().getReceipts([])).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
