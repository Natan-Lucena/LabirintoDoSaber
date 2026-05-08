import { failure, success } from "@wave-telecom/framework/core";
import { StudentAnalysisReportRepository } from "../../../../../domain/repositories/student-analysis-report-repository";
import { StudentAnalysisReport } from "../../../../../domain/entities/student-analysis-report";
import {
  GenerateStudentAnalysisUseCase,
  GenerateStudentAnalysisUseCaseRequest,
} from "../generate-student-analisys/generate-student-analisys-use-case";

export class SaveStudentAnalysisSnapshotUseCase {
  constructor(
    private generateStudentAnalysisUseCase: GenerateStudentAnalysisUseCase,
    private studentAnalysisReportRepository: StudentAnalysisReportRepository,
  ) {}

  async execute(request: GenerateStudentAnalysisUseCaseRequest) {
    const result = await this.generateStudentAnalysisUseCase.execute(request);

    if (!result.ok) {
      return failure(result.error);
    }

    const { categories, total, sessions } = result.value;

    const report = StudentAnalysisReport.create({
      studentId: request.studentId,
      startDate: request.startDate,
      endDate: request.endDate,
      limit: request.limit,
      sessionIds: sessions.map((s) => s.id.value),
      categories: Object.values(categories),
      totalQuestions: total.total,
      totalCorrect: total.correct,
      accuracy: total.accuracy,
    });

    await this.studentAnalysisReportRepository.save(report);

    return success(report);
  }
}
