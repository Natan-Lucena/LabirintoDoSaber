import { Uuid } from "@wave-telecom/framework/core";
import { StudentAnalysisReport } from "../../../domain/entities/student-analysis-report";
import { StudentAnalysisReportRepository } from "../../../domain/repositories/student-analysis-report-repository";

export class MockStudentAnalysisReportRepository
  implements StudentAnalysisReportRepository
{
  private data: StudentAnalysisReport[] = [];

  async save(report: StudentAnalysisReport): Promise<void> {
    this.data.push(report);
  }

  async listByStudentId(studentId: Uuid): Promise<StudentAnalysisReport[]> {
    return this.data
      .filter((r) => r.studentId.value === studentId.value)
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }
}
