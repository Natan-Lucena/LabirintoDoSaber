import { success, Uuid } from "@wave-telecom/framework/core";
import { ReportShareChannel } from "../../../../../domain/entities/report";
import { ReportRepository } from "../../../../../domain/repositories/report-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { loadOwnedReport } from "../report-access";

export interface ShareReportUseCaseRequest {
  educatorId: Uuid;
  reportId: string;
  channel: ReportShareChannel;
}

// RP-08: registra a impressão ou o envio. O backend não manda e-mail.
export class ShareReportUseCase {
  constructor(
    private reportRepository: ReportRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: ShareReportUseCaseRequest) {
    const access = await loadOwnedReport(
      this.reportRepository,
      this.studentRepository,
      request.reportId,
      request.educatorId
    );
    if (!access.ok) return access;

    const shared = access.value.share(request.channel);
    await this.reportRepository.save(shared);

    return success(shared);
  }
}
