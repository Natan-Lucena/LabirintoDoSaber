import { success, Uuid } from "@wave-telecom/framework/core";
import { ReportRepository } from "../../../../../domain/repositories/report-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleReport } from "../report-access";

export interface DeleteReportUseCaseRequest {
  educatorId: Uuid;
  reportId: string;
}

// RP-07: o dono pode excluir.
export class DeleteReportUseCase {
  constructor(
    private reportRepository: ReportRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: DeleteReportUseCaseRequest) {
    const access = await loadAccessibleReport(
      this.reportRepository,
      this.studentAccess,
      request.reportId,
      request.educatorId
    );
    if (!access.ok) return access;

    await this.reportRepository.delete(access.value.id);

    return success(undefined);
  }
}
