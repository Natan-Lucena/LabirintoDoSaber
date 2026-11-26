import { describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepositoryImpl } from "./appointment-repository-impl";
import { PlanRepositoryImpl } from "./plan-repository-impl";

const AFTER = new Date("2026-11-26T15:00:00.000Z");

const appointmentRecord = (id: string, studentId: string) => ({
  id,
  educatorId: Uuid.random().value,
  studentId,
  scheduledAt: new Date("2026-11-27T13:00:00.000Z"),
  observation: null,
  type: null,
  durationMinutes: null,
  status: "PENDING",
  notifiedAt: null,
  metadata: {},
  createdAt: AFTER,
});

const planRecord = (id: string, studentId: string) => ({
  id,
  educatorId: Uuid.random().value,
  studentId,
  type: "PDI",
  status: "ACTIVE",
  source: "MANUAL",
  title: "PDI",
  generalObjective: "Objetivo",
  professionalNotes: null,
  focus: null,
  consideredDifficulties: [],
  startDate: "2026-10-01",
  endDate: "2027-03-01",
  nextReviewDate: null,
  parentPlanId: null,
  sessionDate: null,
  appointmentId: null,
  goals: [],
  createdAt: AFTER,
  updatedAt: AFTER,
  closedAt: null,
});

describe("AppointmentRepositoryImpl.findNextPendingByStudentIds", () => {
  it("agrupa no banco o próximo PENDING por aluno e busca só esses ids", async () => {
    const studentId = Uuid.random();
    const appointmentId = Uuid.random().value;
    const prisma = {
      appointment: {
        aggregateRaw: vi.fn(async () => [{ _id: studentId.value, appointmentId }]),
        findMany: vi.fn(async () => [appointmentRecord(appointmentId, studentId.value)]),
      },
    };
    const repository = new AppointmentRepositoryImpl(prisma as unknown as PrismaClient);

    const result = await repository.findNextPendingByStudentIds([studentId], AFTER);

    expect(prisma.appointment.aggregateRaw).toHaveBeenCalledWith({
      pipeline: [
        {
          $match: {
            studentId: { $in: [studentId.value] },
            status: "PENDING",
            scheduledAt: { $gt: { $date: AFTER.toISOString() } },
          },
        },
        { $sort: { studentId: 1, scheduledAt: 1 } },
        { $group: { _id: "$studentId", appointmentId: { $first: "$_id" } } },
      ],
    });
    expect(prisma.appointment.findMany).toHaveBeenCalledWith({
      where: { id: { in: [appointmentId] } },
    });
    expect(result.map((a) => a.id.value)).toEqual([appointmentId]);
  });

  it("sem alunos ou sem próximo atendimento: não faz a segunda consulta", async () => {
    const prisma = {
      appointment: { aggregateRaw: vi.fn(async () => []), findMany: vi.fn() },
    };
    const repository = new AppointmentRepositoryImpl(prisma as unknown as PrismaClient);

    expect(await repository.findNextPendingByStudentIds([], AFTER)).toEqual([]);
    expect(prisma.appointment.aggregateRaw).not.toHaveBeenCalled();
    expect(await repository.findNextPendingByStudentIds([Uuid.random()], AFTER)).toEqual([]);
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });
});

describe("PlanRepositoryImpl.listForOverview", () => {
  it("busca PDIs, revisões até a data e o PE mais recente de cada aluno, sem varrer os PEs", async () => {
    const studentId = Uuid.random();
    const latestPeId = Uuid.random().value;
    const pdiId = Uuid.random().value;
    const prisma = {
      plan: {
        aggregateRaw: vi.fn(async () => [{ _id: studentId.value, planId: latestPeId }]),
        findMany: vi.fn(async () => [planRecord(pdiId, studentId.value)]),
      },
    };
    const repository = new PlanRepositoryImpl(prisma as unknown as PrismaClient);

    const result = await repository.listForOverview([studentId], "2026-11-28");

    expect(prisma.plan.aggregateRaw).toHaveBeenCalledWith({
      pipeline: [
        { $match: { studentId: { $in: [studentId.value] }, type: "PE", status: "ACTIVE" } },
        { $sort: { studentId: 1, sessionDate: -1, createdAt: -1 } },
        { $group: { _id: "$studentId", planId: { $first: "$_id" } } },
      ],
    });
    expect(prisma.plan.findMany).toHaveBeenCalledWith({
      where: {
        studentId: { in: [studentId.value] },
        status: "ACTIVE",
        OR: [
          { type: "PDI" },
          { nextReviewDate: { lte: "2026-11-28" } },
          { id: { in: [latestPeId] } },
        ],
      },
    });
    expect(result.map((plan) => plan.id.value)).toEqual([pdiId]);
  });

  it("sem alunos: nenhuma consulta", async () => {
    const prisma = { plan: { aggregateRaw: vi.fn(), findMany: vi.fn() } };
    const repository = new PlanRepositoryImpl(prisma as unknown as PrismaClient);

    expect(await repository.listForOverview([], "2026-11-28")).toEqual([]);
    expect(prisma.plan.aggregateRaw).not.toHaveBeenCalled();
  });
});
