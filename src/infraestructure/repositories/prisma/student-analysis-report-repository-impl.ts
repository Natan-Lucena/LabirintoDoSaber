import {
  PrismaClient,
  StudentAnalysisReport as PrismaStudentAnalysisReport,
} from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import {
  CategoryAccuracyData,
  StudentAnalysisReport,
} from "../../../domain/entities/student-analysis-report";
import { StudentAnalysisReportRepository } from "../../../domain/repositories/student-analysis-report-repository";
import { TaskCategory } from "../../../domain/entities/task";

export class StudentAnalysisReportRepositoryImpl
  implements StudentAnalysisReportRepository
{
  constructor(private prismaService: PrismaClient) {}

  async save(report: StudentAnalysisReport): Promise<void> {
    await this.prismaService.studentAnalysisReport.create({
      data: {
        id: report.id.value,
        studentId: report.studentId.value,
        generatedAt: report.generatedAt,
        startDate: report.startDate,
        endDate: report.endDate,
        limit: report.limit,
        sessionIds: report.sessionIds,
        categories: report.categories.map((c) => ({
          category: c.category,
          total: c.total,
          correct: c.correct,
          accuracy: c.accuracy,
        })),
        totalQuestions: report.totalQuestions,
        totalCorrect: report.totalCorrect,
        accuracy: report.accuracy,
      },
    });
  }

  async listByStudentId(studentId: Uuid): Promise<StudentAnalysisReport[]> {
    const results = await this.prismaService.studentAnalysisReport.findMany({
      where: { studentId: studentId.value },
      orderBy: { generatedAt: "desc" },
    });
    return results.map((data) => this.mapToEntity(data));
  }

  private mapToEntity(
    data: PrismaStudentAnalysisReport
  ): StudentAnalysisReport {
    return new StudentAnalysisReport({
      id: data.id,
      studentId: data.studentId,
      generatedAt: data.generatedAt,
      startDate: data.startDate ?? undefined,
      endDate: data.endDate ?? undefined,
      limit: data.limit ?? undefined,
      sessionIds: data.sessionIds,
      categories: data.categories.map((c) => ({
        category: c.category as TaskCategory,
        total: c.total,
        correct: c.correct,
        accuracy: c.accuracy,
      })) as CategoryAccuracyData[],
      totalQuestions: data.totalQuestions,
      totalCorrect: data.totalCorrect,
      accuracy: data.accuracy,
    });
  }
}
