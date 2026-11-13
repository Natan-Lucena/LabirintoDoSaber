import {
  Prisma,
  PrismaClient,
  ScaleApplication as PrismaScaleApplication,
} from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import {
  ScaleApplicationRepository,
  SearchScaleApplicationParams,
} from "../../../domain/repositories/scale-application-repository";
import {
  ApplicationStatus,
  ScaleApplication,
  ScaleInsight,
} from "../../../domain/entities/scale-application";

export class ScaleApplicationRepositoryImpl implements ScaleApplicationRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(application: ScaleApplication): Promise<void> {
    const data = {
      templateId: application.templateId.value,
      templateCode: application.templateCode,
      templateVersion: application.templateVersion,
      templateName: application.templateName,
      studentId: application.studentId.value,
      educatorId: application.educatorId.value,
      appointmentId: application.appointmentId?.value ?? null,
      status: application.status,
      insight: application.insight
        ? {
            text: application.insight.text,
            generatedAt: application.insight.generatedAt,
            preliminary: application.insight.preliminary,
          }
        : null,
      startedAt: application.startedAt,
      updatedAt: application.updatedAt,
      completedAt: application.completedAt ?? null,
    };

    const answers = application.answers.map((answer) => ({
      itemId: answer.itemId,
      value: answer.value,
    }));

    await this.prismaService.scaleApplication.upsert({
      where: { id: application.id.value },
      update: { ...data, answers: { set: answers } },
      create: { id: application.id.value, ...data, answers },
    });
  }

  async saveInsight(id: Uuid, insight: ScaleInsight): Promise<boolean> {
    try {
      await this.prismaService.scaleApplication.update({
        where: { id: id.value },
        data: {
          insight: {
            text: insight.text,
            generatedAt: insight.generatedAt,
            preliminary: insight.preliminary,
          },
        },
      });
      return true;
    } catch (error) {
      // P2025: o registro foi excluído enquanto a IA respondia.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return false;
      }
      throw error;
    }
  }

  async findById(id: Uuid): Promise<ScaleApplication | null> {
    const record = await this.prismaService.scaleApplication.findUnique({
      where: { id: id.value },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async findDraft(studentId: Uuid, templateCode: string): Promise<ScaleApplication | null> {
    const record = await this.prismaService.scaleApplication.findFirst({
      where: {
        studentId: studentId.value,
        templateCode,
        status: ApplicationStatus.DRAFT,
      },
      orderBy: { updatedAt: "desc" },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async search(params: SearchScaleApplicationParams): Promise<ScaleApplication[]> {
    if (params.studentIds.length === 0) return [];

    const where: Prisma.ScaleApplicationWhereInput = {
      studentId: { in: params.studentIds.map((id) => id.value) },
    };
    if (params.status) where.status = params.status;
    if (params.completedFrom || params.completedTo) {
      where.completedAt = {
        ...(params.completedFrom ? { gte: params.completedFrom } : {}),
        ...(params.completedTo ? { lte: params.completedTo } : {}),
      };
    }

    const records = await this.prismaService.scaleApplication.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: params.limit,
    });

    return records.map((record) => this.mapToEntity(record));
  }

  async delete(id: Uuid): Promise<void> {
    await this.prismaService.scaleApplication.delete({ where: { id: id.value } });
  }

  async listDraftsUpdatedBefore(date: Date): Promise<ScaleApplication[]> {
    const records = await this.prismaService.scaleApplication.findMany({
      where: { status: ApplicationStatus.DRAFT, updatedAt: { lte: date } },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  private mapToEntity(record: PrismaScaleApplication): ScaleApplication {
    return ScaleApplication.fromPersistence({
      id: new Uuid(record.id),
      templateId: new Uuid(record.templateId),
      templateCode: record.templateCode,
      templateVersion: record.templateVersion,
      templateName: record.templateName,
      studentId: new Uuid(record.studentId),
      educatorId: new Uuid(record.educatorId),
      appointmentId: record.appointmentId ? new Uuid(record.appointmentId) : undefined,
      status: record.status as ApplicationStatus,
      answers: record.answers.map((answer) => ({
        itemId: answer.itemId,
        value: answer.value,
      })),
      insight: record.insight
        ? {
            text: record.insight.text,
            generatedAt: record.insight.generatedAt,
            preliminary: record.insight.preliminary,
          }
        : undefined,
      startedAt: record.startedAt,
      updatedAt: record.updatedAt,
      completedAt: record.completedAt ?? undefined,
    });
  }
}
