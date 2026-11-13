import { success, Uuid } from "@wave-telecom/framework/core";
import { ReportRepository } from "../../../../../domain/repositories/report-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { loadOwnedReport } from "../report-access";

export interface DeleteReportUseCaseRequest {
  educatorId: Uuid;
  reportId: string;
}

// RP-07: o dono pode excluir.
export class DeleteReportUseCase {
  constructor(
    private reportRepository: ReportRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: DeleteReportUseCaseRequest) {
    const access = await loadOwnedReport(
      this.reportRepository,
      this.studentRepository,
      request.reportId,
      request.educatorId
    );
    if (!access.ok) return access;

    await this.reportRepository.delete(access.value.id);

    return success(undefined);
  }
}
