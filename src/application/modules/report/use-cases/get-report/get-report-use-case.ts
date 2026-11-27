import { success, Uuid } from "@wave-telecom/framework/core";
import { ReportRepository } from "../../../../../domain/repositories/report-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { loadAuthorNames } from "../../../../services/author-names";
import { loadAccessibleReport } from "../report-access";

export interface GetReportUseCaseRequest {
  educatorId: Uuid;
  reportId: string;
}

export class GetReportUseCase {
  constructor(
    private reportRepository: ReportRepository,
    private studentAccess: StudentAccessService,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: GetReportUseCaseRequest) {
    const access = await loadAccessibleReport(
      this.reportRepository,
      this.studentAccess,
      request.reportId,
      request.educatorId
    );
    if (!access.ok) return access;
    const report = access.value;

    // EQ-12: nome do autor só quando não é quem lê.
    const authorNames = await loadAuthorNames(
      this.educatorRepository,
      [report.educatorId],
      request.educatorId
    );

    return success({ report, authorName: authorNames.get(report.educatorId.value) });
  }
}
