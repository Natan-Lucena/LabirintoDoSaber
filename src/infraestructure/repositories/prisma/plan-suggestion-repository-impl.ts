import { PrismaClient, PlanSuggestion as PrismaPlanSuggestion } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { PlanSuggestionRepository } from "../../../domain/repositories/plan-suggestion-repository";
import {
  PlanSuggestion,
  SuggestionKind,
  SuggestionStatus,
} from "../../../domain/entities/plan-suggestion";
import { GoalStatus } from "../../../domain/entities/plan";

export class PlanSuggestionRepositoryImpl implements PlanSuggestionRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(suggestion: PlanSuggestion): Promise<void> {
    const change = suggestion.proposedChange;
    const data = {
      planId: suggestion.planId.value,
      educatorId: suggestion.educatorId.value,
      studentId: suggestion.studentId.value,
      goalId: suggestion.goalId?.value ?? null,
      kind: suggestion.kind,
      text: suggestion.text,
      proposedChange: {
        status: change.status ?? null,
        description: change.description ?? null,
        successCriterion: change.successCriterion ?? null,
        nextReviewDate: change.nextReviewDate ?? null,
      },
      status: suggestion.status,
      createdAt: suggestion.createdAt,
      resolvedAt: suggestion.resolvedAt ?? null,
    };

    await this.prismaService.planSuggestion.upsert({
      where: { id: suggestion.id.value },
      update: data,
      create: { id: suggestion.id.value, ...data },
    });
  }

  async findById(id: Uuid): Promise<PlanSuggestion | null> {
    const record = await this.prismaService.planSuggestion.findUnique({
      where: { id: id.value },
    });

    return record ? this.mapToEntity(record) : null;
  }

  async listByEducatorId(
    educatorId: Uuid,
    status?: SuggestionStatus
  ): Promise<PlanSuggestion[]> {
    const records = await this.prismaService.planSuggestion.findMany({
      where: { educatorId: educatorId.value, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });

    return records.map((record) => this.mapToEntity(record));
  }

  async countPendingByPlanId(planId: Uuid): Promise<number> {
    return this.prismaService.planSuggestion.count({
      where: { planId: planId.value, status: SuggestionStatus.PENDING },
    });
  }

  async dismissPendingByPlanId(planId: Uuid): Promise<void> {
    await this.prismaService.planSuggestion.updateMany({
      where: { planId: planId.value, status: SuggestionStatus.PENDING },
      data: { status: SuggestionStatus.DISMISSED, resolvedAt: new Date() },
    });
  }

  private mapToEntity(record: PrismaPlanSuggestion): PlanSuggestion {
    const change = record.proposedChange;

    return PlanSuggestion.fromPersistence({
      id: new Uuid(record.id),
      planId: new Uuid(record.planId),
      educatorId: new Uuid(record.educatorId),
      studentId: new Uuid(record.studentId),
      goalId: record.goalId ? new Uuid(record.goalId) : undefined,
      kind: record.kind as SuggestionKind,
      text: record.text,
      proposedChange: {
        status: (change.status as GoalStatus | null) ?? undefined,
        description: change.description ?? undefined,
        successCriterion: change.successCriterion ?? undefined,
        nextReviewDate: change.nextReviewDate ?? undefined,
      },
      status: record.status as SuggestionStatus,
      createdAt: record.createdAt,
      resolvedAt: record.resolvedAt ?? undefined,
    });
  }
}
