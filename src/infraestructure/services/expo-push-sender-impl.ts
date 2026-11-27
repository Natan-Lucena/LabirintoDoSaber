import {
  PushMessage,
  PushReceiptOutcome,
  PushSender,
  PushTicket,
} from "../../domain/services/push-sender";

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
// Limites da API da Expo por requisição.
const SEND_BATCH = 100;
const RECEIPTS_BATCH = 1000;
// Sem resposta em 10 s, o lote conta como falha de rede.
const TIMEOUT_MS = 10_000;

interface ExpoResult {
  status?: string;
  id?: string;
  details?: { error?: string };
}

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size)
  );

const isDeviceNotRegistered = (result: ExpoResult | undefined) =>
  result?.details?.error === "DeviceNotRegistered";

// API HTTP de push da Expo (PU-02, PU-07). Com EXPO_ACCESS_TOKEN definido, vai
// no Authorization. Falha vira ticket de erro; o log leva só o status, nunca
// token ou texto.
export class ExpoPushSenderImpl implements PushSender {
  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    const tickets: PushTicket[] = [];
    for (const batch of chunk(messages, SEND_BATCH)) {
      const results = await this.post<ExpoResult[]>(
        SEND_URL,
        batch.map((message) => ({ ...message, sound: "default" })),
        "EXPO_PUSH_SEND_FAILED"
      );
      const valid = Array.isArray(results) && results.length === batch.length;
      if (!valid && results !== null) console.error("EXPO_PUSH_SEND_FAILED", { status: "INVALID_RESPONSE" });
      batch.forEach((_, index) => {
        const result = valid ? results[index] : undefined;
        tickets.push(
          result?.status === "ok" && typeof result.id === "string"
            ? { status: "ok", receiptId: result.id }
            : { status: "error", deviceNotRegistered: isDeviceNotRegistered(result) }
        );
      });
    }
    return tickets;
  }

  async getReceipts(receiptIds: string[]): Promise<PushReceiptOutcome[]> {
    const outcomes: PushReceiptOutcome[] = [];
    for (const batch of chunk(receiptIds, RECEIPTS_BATCH)) {
      const results = await this.post<Record<string, ExpoResult>>(
        RECEIPTS_URL,
        { ids: batch },
        "EXPO_PUSH_RECEIPTS_FAILED"
      );
      if (!results || typeof results !== "object") continue;
      for (const id of batch) {
        const result = results[id];
        if (!result) continue;
        outcomes.push({
          receiptId: id,
          status: result.status === "ok" ? "ok" : "error",
          deviceNotRegistered: isDeviceNotRegistered(result),
        });
      }
    }
    return outcomes;
  }

  // Devolve o `data` da resposta, ou null quando a Expo falhou.
  private async post<T>(url: string, body: unknown, code: string): Promise<T | null> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    const accessToken = process.env.EXPO_ACCESS_TOKEN;
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        console.error(code, { status: response.status });
        return null;
      }
      const json = (await response.json()) as { data?: T };
      return json.data ?? null;
    } catch {
      console.error(code, { status: "NETWORK" });
      return null;
    }
  }
}
