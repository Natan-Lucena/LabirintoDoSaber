import { Uuid } from "@wave-telecom/framework/core";
import { StudentAnalysisReportRepository } from "../../../../../domain/repositories/student-analysis-report-repository";
import { StudentAnalysisReport } from "../../../../../domain/entities/student-analysis-report";

export interface ListStudentAnalysisHistoryRequest {
  studentId: string;
}

export class ListStudentAnalysisHistoryUseCase {
  constructor(
    private studentAnalysisReportRepository: StudentAnalysisReportRepository
  ) {}

  async execute(
    request: ListStudentAnalysisHistoryRequest
  ): Promise<StudentAnalysisReport[]> {
    return this.studentAnalysisReportRepository.listByStudentId(
      new Uuid(request.studentId)
    );
  }
}
