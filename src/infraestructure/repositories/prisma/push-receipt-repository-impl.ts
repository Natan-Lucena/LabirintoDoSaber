import { PrismaClient } from "@prisma/client";
import {
  PendingPushReceipt,
  PushReceiptRepository,
} from "../../../domain/repositories/push-receipt-repository";

export class PushReceiptRepositoryImpl implements PushReceiptRepository {
  constructor(private prismaService: PrismaClient) {}

  async saveMany(receipts: PendingPushReceipt[]): Promise<void> {
    if (receipts.length === 0) return;
    await this.prismaService.pushReceipt.createMany({
      data: receipts.map((receipt) => ({
        id: receipt.receiptId,
        token: receipt.token,
        createdAt: receipt.createdAt,
      })),
    });
  }

  async listAll(): Promise<PendingPushReceipt[]> {
    const records = await this.prismaService.pushReceipt.findMany();
    return records.map((record) => ({
      receiptId: record.id,
      token: record.token,
      createdAt: record.createdAt,
    }));
  }

  async deleteByIds(receiptIds: string[]): Promise<void> {
    if (receiptIds.length === 0) return;
    await this.prismaService.pushReceipt.deleteMany({ where: { id: { in: receiptIds } } });
  }

  async deleteCreatedBefore(date: Date): Promise<number> {
    const result = await this.prismaService.pushReceipt.deleteMany({
      where: { createdAt: { lt: date } },
    });
    return result.count;
  }
}
