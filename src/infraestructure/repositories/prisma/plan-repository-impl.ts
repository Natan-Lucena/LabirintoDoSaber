import {
  PrismaClient,
  Prisma,
  Plan as PrismaPlan,
} from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import {
  PlanRepository,
  SearchPlanParams,
} from "../../../domain/repositories/plan-repository";
import {
  GoalStatus,
  Plan,
  PlanSource,
  PlanStatus,
  PlanType,
} from "../../../domain/entities/plan";

export class PlanRepositoryImpl implements PlanRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(plan: Plan): Promise<void> {
    const data = {
      educatorId: plan.educatorId.value,
      studentId: plan.studentId.value,
      type: plan.type,
      status: plan.status,
      source: plan.source,
      title: plan.title,
      generalObjective: plan.generalObjective,
      professionalNotes: plan.professionalNotes ?? null,
      focus: plan.focus ?? null,
      consideredDifficulties: plan.consideredDifficulties,
      startDate: plan.startDate,
      endDate: plan.endDate,
      nextReviewDate: plan.nextReviewDate ?? null,
      parentPlanId: plan.parentPlanId?.value ?? null,
      sessionDate: plan.sessionDate ?? null,
      appointmentId: plan.appointmentId?.value ?? null,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      closedAt: plan.closedAt ?? null,
    };

    const goals = plan.goals.map((goal) => ({
      id: goal.id.value,
      order: goal.order,
      description: goal.description,
      successCriterion: goal.successCriterion ?? null,
      status: goal.status,
      achievedAt: goal.achievedAt ?? null,
      updatedAt: goal.updatedAt,
    }));

    await this.prismaService.plan.upsert({
      where: { id: plan.id.value },
      update: { ...data, goals: { set: goals } },
      create: { id: plan.id.value, ...data, goals },
    });
  }

  async findById(id: Uuid): Promise<Plan | null> {
    const record = await this.prismaService.plan.findUnique({
      where: { id: id.value },
    });

    if (!record) return null;

    return this.mapToEntity(record);
  }

  async search(params: SearchPlanParams): Promise<Plan[]> {
    const where: Prisma.PlanWhereInput = {
      educatorId: params.educatorId.value,
    };

    if (params.studentId) where.studentId = params.studentId.value;
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;

    const records = await this.prismaService.plan.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return records.map((record) => this.mapToEntity(record));
  }

  async findActivePdi(studentId: Uuid): Promise<Plan | null> {
    const record = await this.prismaService.plan.findFirst({
      where: {
        studentId: studentId.value,
        type: PlanType.PDI,
        status: PlanStatus.ACTIVE,
      },
    });

    if (!record) return null;

    return this.mapToEntity(record);
  }

  private mapToEntity(record: PrismaPlan): Plan {
    return Plan.fromPersistence({
      id: new Uuid(record.id),
      educatorId: new Uuid(record.educatorId),
      studentId: new Uuid(record.studentId),
      type: record.type as PlanType,
      status: record.status as PlanStatus,
      source: record.source as PlanSource,
      title: record.title,
      generalObjective: record.generalObjective,
      professionalNotes: record.professionalNotes ?? undefined,
      focus: record.focus ?? undefined,
      consideredDifficulties: record.consideredDifficulties,
      startDate: record.startDate,
      endDate: record.endDate,
      nextReviewDate: record.nextReviewDate ?? undefined,
      parentPlanId: record.parentPlanId
        ? new Uuid(record.parentPlanId)
        : undefined,
      sessionDate: record.sessionDate ?? undefined,
      appointmentId: record.appointmentId
        ? new Uuid(record.appointmentId)
        : undefined,
      goals: [...record.goals]
        .sort((a, b) => a.order - b.order)
        .map((goal) => ({
          id: new Uuid(goal.id),
          order: goal.order,
          description: goal.description,
          successCriterion: goal.successCriterion ?? undefined,
          status: goal.status as GoalStatus,
          achievedAt: goal.achievedAt ?? undefined,
          updatedAt: goal.updatedAt,
        })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      closedAt: record.closedAt ?? undefined,
    });
  }
}
