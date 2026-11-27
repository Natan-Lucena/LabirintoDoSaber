import { success } from "@wave-telecom/framework/core";
import { PushReceiptRepository } from "../../../../../domain/repositories/push-receipt-repository";
import { PushTokenRepository } from "../../../../../domain/repositories/push-token-repository";
import { PushReceiptOutcome, PushSender } from "../../../../../domain/services/push-sender";

// A Expo guarda os recibos por 24 h; depois disso não há mais resposta.
export const PUSH_RECEIPT_RETENTION_MS = 24 * 60 * 60 * 1000;

// PU-05: recibos com DeviceNotRegistered apagam o token. Roda no cron do
// watchdog (~20 h depois do envio, dentro da janela da Expo). Os recibos que a
// Expo ainda não tem ficam para a próxima execução, até a retenção. Nunca lança:
// uma falha aqui não pode derrubar o watchdog.
export class CheckPushReceiptsUseCase {
  constructor(
    private receiptRepository: PushReceiptRepository,
    private pushTokenRepository: PushTokenRepository,
    private pushSender: PushSender
  ) {}

  async execute(now: Date = new Date()) {
    try {
      return success(await this.check(now));
    } catch {
      console.error("PUSH_RECEIPTS_FAILED");
      return success({ checked: 0, tokensRemoved: 0 });
    }
  }

  private async check(now: Date) {
    await this.receiptRepository.deleteCreatedBefore(
      new Date(now.getTime() - PUSH_RECEIPT_RETENTION_MS)
    );
    const pending = await this.receiptRepository.listAll();
    if (pending.length === 0) return { checked: 0, tokensRemoved: 0 };

    const outcomes: PushReceiptOutcome[] = await this.pushSender.getReceipts(
      pending.map((r) => r.receiptId)
    );

    const tokenByReceipt = new Map(pending.map((r) => [r.receiptId, r.token]));
    const deadTokens = outcomes
      .filter((outcome) => outcome.deviceNotRegistered)
      .flatMap((outcome) => tokenByReceipt.get(outcome.receiptId) ?? []);

    const tokensRemoved = deadTokens.length
      ? await this.pushTokenRepository.deleteByTokens([...new Set(deadTokens)])
      : 0;
    const checked = outcomes.map((outcome) => outcome.receiptId);
    if (checked.length > 0) await this.receiptRepository.deleteByIds(checked);

    return { checked: checked.length, tokensRemoved };
  }
}
