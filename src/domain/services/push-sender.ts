// Porta de envio de push (PU-02). A implementação é a API HTTP da Expo.
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

// Um ticket por mensagem, na mesma ordem.
export type PushTicket =
  | { status: "ok"; receiptId: string }
  | { status: "error"; deviceNotRegistered: boolean };

export interface PushReceiptOutcome {
  receiptId: string;
  status: "ok" | "error";
  deviceNotRegistered: boolean;
}

export interface PushSender {
  // Falha do provedor vira ticket de erro, sem exceção.
  send(messages: PushMessage[]): Promise<PushTicket[]>;
  // Só os recibos já prontos; os que faltam ficam para a próxima consulta.
  getReceipts(receiptIds: string[]): Promise<PushReceiptOutcome[]>;
}
