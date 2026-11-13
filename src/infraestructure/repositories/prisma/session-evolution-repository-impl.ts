import {
  PrismaClient,
  Prisma,
  SessionEvolution as PrismaSessionEvolution,
} from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import {
  SearchSessionEvolutionParams,
  SessionEvolutionAlreadyExistsError,
  SessionEvolutionRepository,
} from "../../../domain/repositories/session-evolution-repository";
import {
  CriterionResult,
  SessionEvolution,
} from "../../../domain/entities/session-evolution";
import { GoalStatus, PlanType } from "../../../domain/entities/plan";

export class SessionEvolutionRepositoryImpl implements SessionEvolutionRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(evolution: SessionEvolution): Promise<void> {
    const data = {
      sessionId: evolution.sessionId.value,
      studentId: evolution.studentId.value,
      educatorId: evolution.educatorId.value,
      appointmentId: evolution.appointmentId?.value ?? null,
      planId: evolution.planId?.value ?? null,
      planType: evolution.planType ?? null,
      planTitle: evolution.planTitle ?? null,
      sessionDate: evolution.sessionDate,
      durationMinutes: evolution.durationMinutes ?? null,
      descriptiveRecord: evolution.descriptiveRecord,
      nextSessionSuggestion: evolution.nextSessionSuggestion ?? null,
      createdAt: evolution.createdAt,
      updatedAt: evolution.updatedAt,
    };

    const criteria = evolution.criteria.map((criterion) => ({
      id: criterion.id.value,
      goalId: criterion.goalId?.value ?? null,
      description: criterion.description,
      successCriterion: criterion.successCriterion ?? null,
      attempts: criterion.attempts ?? null,
      successes: criterion.successes ?? null,
      result: criterion.result,
      note: criterion.note ?? null,
    }));

    const goalUpdates = evolution.goalUpdates.map((update) => ({
      goalId: update.goalId,
      status: update.status,
    }));

    try {
      await this.prismaService.sessionEvolution.upsert({
        where: { id: evolution.id.value },
        update: {
          ...data,
          criteria: { set: criteria },
          goalUpdates: { set: goalUpdates },
        },
        create: { id: evolution.id.value, ...data, criteria, goalUpdates },
      });
    } catch (error) {
      // P2002: violação de unicidade; aqui só existe a de sessionId.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new SessionEvolutionAlreadyExistsError();
      }
      throw error;
    }
  }

  async findById(id: Uuid): Promise<SessionEvolution | null> {
    const record = await this.prismaService.sessionEvolution.findUnique({
      where: { id: id.value },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async findBySessionId(sessionId: Uuid): Promise<SessionEvolution | null> {
    const record = await this.prismaService.sessionEvolution.findUnique({
      where: { sessionId: sessionId.value },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async search(params: SearchSessionEvolutionParams): Promise<SessionEvolution[]> {
    if (params.studentIds.length === 0) return [];

    const where: Prisma.SessionEvolutionWhereInput = {
      studentId: { in: params.studentIds.map((id) => id.value) },
    };

    if (params.from || params.to) {
      where.sessionDate = {
        ...(params.from ? { gte: params.from } : {}),
        ...(params.to ? { lte: params.to } : {}),
      };
    }

    const records = await this.prismaService.sessionEvolution.findMany({
      where,
      orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
      take: params.limit,
    });

    return records.map((record) => this.mapToEntity(record));
  }

  async findIdsBySessionIds(sessionIds: Uuid[]): Promise<Map<string, string>> {
    if (sessionIds.length === 0) return new Map();

    const records = await this.prismaService.sessionEvolution.findMany({
      where: { sessionId: { in: sessionIds.map((id) => id.value) } },
      select: { id: true, sessionId: true },
    });

    return new Map(records.map((record) => [record.sessionId, record.id]));
  }

  private mapToEntity(record: PrismaSessionEvolution): SessionEvolution {
    return SessionEvolution.fromPersistence({
      id: new Uuid(record.id),
      sessionId: new Uuid(record.sessionId),
      studentId: new Uuid(record.studentId),
      educatorId: new Uuid(record.educatorId),
      appointmentId: record.appointmentId
        ? new Uuid(record.appointmentId)
        : undefined,
      planId: record.planId ? new Uuid(record.planId) : undefined,
      planType: (record.planType as PlanType | null) ?? undefined,
      planTitle: record.planTitle ?? undefined,
      sessionDate: record.sessionDate,
      durationMinutes: record.durationMinutes ?? undefined,
      criteria: record.criteria.map((criterion) => ({
        id: new Uuid(criterion.id),
        goalId: criterion.goalId ? new Uuid(criterion.goalId) : undefined,
        description: criterion.description,
        successCriterion: criterion.successCriterion ?? undefined,
        attempts: criterion.attempts ?? undefined,
        successes: criterion.successes ?? undefined,
        result: criterion.result as CriterionResult,
        note: criterion.note ?? undefined,
      })),
      descriptiveRecord: record.descriptiveRecord,
      nextSessionSuggestion: record.nextSessionSuggestion ?? undefined,
      goalUpdates: record.goalUpdates.map((update) => ({
        goalId: update.goalId,
        status: update.status as GoalStatus,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
