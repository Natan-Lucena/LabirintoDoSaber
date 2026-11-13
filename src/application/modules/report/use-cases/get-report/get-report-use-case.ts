import { Uuid } from "@wave-telecom/framework/core";
import { ReportRepository } from "../../../../../domain/repositories/report-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { loadOwnedReport } from "../report-access";

export interface GetReportUseCaseRequest {
  educatorId: Uuid;
  reportId: string;
}

export class GetReportUseCase {
  constructor(
    private reportRepository: ReportRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: GetReportUseCaseRequest) {
    return loadOwnedReport(
      this.reportRepository,
      this.studentRepository,
      request.reportId,
      request.educatorId
    );
  }
}
