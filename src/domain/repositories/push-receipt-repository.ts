// Recibo de envio da Expo ainda não conferido (PU-05).
export interface PendingPushReceipt {
  receiptId: string;
  token: string;
  createdAt: Date;
}

export interface PushReceiptRepository {
  saveMany(receipts: PendingPushReceipt[]): Promise<void>;
  listAll(): Promise<PendingPushReceipt[]>;
  deleteByIds(receiptIds: string[]): Promise<void>;
  deleteCreatedBefore(date: Date): Promise<number>;
}
