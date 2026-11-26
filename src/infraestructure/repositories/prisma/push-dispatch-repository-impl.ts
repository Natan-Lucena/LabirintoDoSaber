import { Prisma, PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { PushDispatchRepository } from "../../../domain/repositories/push-dispatch-repository";

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export class PushDispatchRepositoryImpl implements PushDispatchRepository {
  constructor(private prismaService: PrismaClient) {}

  // O índice único educatorId + date decide quem envia, sem ler antes.
  async claim(educatorId: Uuid, date: string, now: Date): Promise<boolean> {
    try {
      await this.prismaService.pushDispatch.create({
        data: { id: Uuid.random().value, educatorId: educatorId.value, date, createdAt: now },
      });
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  async deleteCreatedBefore(date: Date): Promise<number> {
    const result = await this.prismaService.pushDispatch.deleteMany({
      where: { createdAt: { lt: date } },
    });
    return result.count;
  }
}
