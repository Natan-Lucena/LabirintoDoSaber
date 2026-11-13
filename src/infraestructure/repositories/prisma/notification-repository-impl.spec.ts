import { describe, it, expect, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { NotificationRepositoryImpl } from "./notification-repository-impl";
import { Notification } from "../../../domain/entities/notification";

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.0",
  });

const notification = () =>
  Notification.appointmentsToday({
    educatorId: Uuid.random(),
    date: "2026-11-12",
    count: 1,
  });

// Simula outro cron em paralelo: entre a busca das chaves e o createMany, a
// outra execução grava a primeira notificação.
function makePrisma(parallelKey: string) {
  const stored = new Set<string>();
  let calls = 0;
  const prisma = {
    notification: {
      findMany: vi.fn(async ({ where }: any) =>
        (where.dedupeKey.in as string[])
          .filter((key) => stored.has(key))
          .map((dedupeKey) => ({ dedupeKey }))
      ),
      createMany: vi.fn(async ({ data }: any) => {
        calls++;
        if (calls === 1) {
          stored.add(parallelKey);
          throw uniqueViolation();
        }
        for (const row of data) stored.add(row.dedupeKey);
        return { count: data.length };
      }),
    },
  };
  return { prisma, stored };
}

describe("NotificationRepositoryImpl.createMany", () => {
  it("should retry once after a unique violation from a parallel cron, without gaps", async () => {
    const first = notification();
    const second = notification();
    const { prisma, stored } = makePrisma(first.dedupeKey);
    const repository = new NotificationRepositoryImpl(prisma as unknown as PrismaClient);

    const created = await repository.createMany([first, second]);

    expect(created).toBe(1);
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(2);
    const retried = prisma.notification.createMany.mock.calls[1][0].data;
    expect(retried.map((row: any) => row.dedupeKey)).toEqual([second.dedupeKey]);
    expect([...stored].sort()).toEqual([first.dedupeKey, second.dedupeKey].sort());
  });

  it("should not swallow other errors", async () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([]),
        createMany: vi.fn().mockRejectedValue(new Error("boom")),
      },
    };
    const repository = new NotificationRepositoryImpl(prisma as unknown as PrismaClient);

    await expect(repository.createMany([notification()])).rejects.toThrow("boom");
    expect(prisma.notification.createMany).toHaveBeenCalledTimes(1);
  });
});
