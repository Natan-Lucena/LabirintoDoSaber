import { Prisma, PrismaClient, Report as PrismaReport } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Report,
  ReportAudience,
  ReportContent,
  ReportSection,
  ReportShare,
  ReportShareChannel,
  ReportSummaryProps,
  ReportType,
} from "../../../domain/entities/report";
import {
  ReportRepository,
  SearchReportParams,
} from "../../../domain/repositories/report-repository";

// Todos os campos menos o conteúdo, para a listagem.
const SUMMARY_SELECT = {
  id: true,
  studentId: true,
  studentName: true,
  educatorId: true,
  type: true,
  audience: true,
  periodFrom: true,
  periodTo: true,
  sections: true,
  synthesisFailed: true,
  shares: true,
  createdAt: true,
} satisfies Prisma.ReportSelect;

type ReportSummaryRecord = Omit<PrismaReport, "content">;

export class ReportRepositoryImpl implements ReportRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(report: Report): Promise<void> {
    const shares = report.shares.map((share) => ({
      channel: share.channel,
      at: share.at,
    }));

    // O conteúdo só é gravado na criação (RP-03); os envios entram por addShare.
    await this.prismaService.report.upsert({
      where: { id: report.id.value },
      update: {},
      create: {
        id: report.id.value,
        studentId: report.studentId.value,
        studentName: report.studentName,
        educatorId: report.educatorId.value,
        type: report.type,
        audience: report.audience,
        periodFrom: report.periodFrom,
        periodTo: report.periodTo,
        sections: report.sections,
        content: report.content as unknown as Prisma.InputJsonObject,
        synthesisFailed: report.synthesisFailed,
        shares,
        createdAt: report.createdAt,
      },
    });
  }

  async findById(id: Uuid): Promise<Report | null> {
    const record = await this.prismaService.report.findUnique({
      where: { id: id.value },
    });
    if (!record) return null;

    return Report.fromPersistence({
      ...this.mapToSummary(record),
      content: record.content as unknown as ReportContent,
    });
  }

  async search(params: SearchReportParams): Promise<ReportSummaryProps[]> {
    if (params.studentIds.length === 0) return [];

    const records = await this.prismaService.report.findMany({
      where: { studentId: { in: params.studentIds.map((id) => id.value) } },
      select: SUMMARY_SELECT,
      orderBy: { createdAt: "desc" },
      take: params.limit,
    });

    return records.map((record) => this.mapToSummary(record));
  }

  async addShare(id: Uuid, share: ReportShare): Promise<void> {
    await this.prismaService.report.update({
      where: { id: id.value },
      data: { shares: { push: { channel: share.channel, at: share.at } } },
    });
  }

  // deleteMany: exclusão concorrente do mesmo relatório não vira 500.
  async delete(id: Uuid): Promise<void> {
    await this.prismaService.report.deleteMany({ where: { id: id.value } });
  }

  private mapToSummary(record: ReportSummaryRecord): ReportSummaryProps {
    return {
      id: new Uuid(record.id),
      studentId: new Uuid(record.studentId),
      studentName: record.studentName,
      educatorId: new Uuid(record.educatorId),
      type: record.type as ReportType,
      audience: record.audience as ReportAudience,
      periodFrom: record.periodFrom,
      periodTo: record.periodTo,
      sections: record.sections as ReportSection[],
      synthesisFailed: record.synthesisFailed,
      shares: record.shares.map((share) => ({
        channel: share.channel as ReportShareChannel,
        at: share.at,
      })),
      createdAt: record.createdAt,
    };
  }
}
