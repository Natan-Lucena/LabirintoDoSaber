import { PrismaClient, PlanReview as PrismaPlanReview } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { PlanReviewRepository } from "../../../domain/repositories/plan-review-repository";
import { PlanReview } from "../../../domain/entities/plan-review";
import { GoalStatus } from "../../../domain/entities/plan";

export class PlanReviewRepositoryImpl implements PlanReviewRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(review: PlanReview): Promise<void> {
    const data = {
      planId: review.planId.value,
      educatorId: review.educatorId.value,
      reviewedAt: review.reviewedAt,
      note: review.note,
      nextReviewDate: review.nextReviewDate ?? null,
    };

    const goalStatuses = review.goalStatuses.map((item) => ({
      goalId: item.goalId.value,
      status: item.status,
    }));

    await this.prismaService.planReview.upsert({
      where: { id: review.id.value },
      update: { ...data, goalStatuses: { set: goalStatuses } },
      create: { id: review.id.value, ...data, goalStatuses },
    });
  }

  async listByPlanId(planId: Uuid): Promise<PlanReview[]> {
    const records = await this.prismaService.planReview.findMany({
      where: { planId: planId.value },
      orderBy: { reviewedAt: "desc" },
    });

    return records.map((record) => this.mapToEntity(record));
  }

  private mapToEntity(record: PrismaPlanReview): PlanReview {
    return PlanReview.fromPersistence({
      id: new Uuid(record.id),
      planId: new Uuid(record.planId),
      educatorId: new Uuid(record.educatorId),
      reviewedAt: record.reviewedAt,
      note: record.note,
      nextReviewDate: record.nextReviewDate ?? undefined,
      goalStatuses: record.goalStatuses.map((item) => ({
        goalId: new Uuid(item.goalId),
        status: item.status as GoalStatus,
      })),
    });
  }
}
