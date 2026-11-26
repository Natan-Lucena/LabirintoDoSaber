import { describe, it, expect, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { PushDispatchRepositoryImpl } from "./push-dispatch-repository-impl";

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.0",
  });

// O índice único educatorId + date é o que garante um push por dia, mesmo com
// dois crons em paralelo (BE-PU-01).
describe("PushDispatchRepositoryImpl.claim", () => {
  const makePrisma = () => {
    const keys = new Set<string>();
    return {
      pushDispatch: {
        create: vi.fn(async ({ data }: any) => {
          const key = `${data.educatorId}:${data.date}`;
          if (keys.has(key)) throw uniqueViolation();
          keys.add(key);
          return data;
        }),
      },
    };
  };

  it("should claim the day once per educator", async () => {
    const repository = new PushDispatchRepositoryImpl(makePrisma() as unknown as PrismaClient);
    const educator = Uuid.random();
    const now = new Date();

    expect(await repository.claim(educator, "2026-11-26", now)).toBe(true);
    expect(await repository.claim(educator, "2026-11-26", now)).toBe(false);
    expect(await repository.claim(educator, "2026-11-27", now)).toBe(true);
    expect(await repository.claim(Uuid.random(), "2026-11-26", now)).toBe(true);
  });

  it("should not swallow other errors", async () => {
    const prisma = { pushDispatch: { create: vi.fn().mockRejectedValue(new Error("boom")) } };
    const repository = new PushDispatchRepositoryImpl(prisma as unknown as PrismaClient);

    await expect(repository.claim(Uuid.random(), "2026-11-26", new Date())).rejects.toThrow("boom");
  });
});
