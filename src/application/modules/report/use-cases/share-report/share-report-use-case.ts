import { success, Uuid } from "@wave-telecom/framework/core";
import { ReportShareChannel } from "../../../../../domain/entities/report";
import { ReportRepository } from "../../../../../domain/repositories/report-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleReport } from "../report-access";

export interface ShareReportUseCaseRequest {
  educatorId: Uuid;
  reportId: string;
  channel: ReportShareChannel;
}

// RP-08: registra a impressão ou o envio. O backend não manda e-mail.
export class ShareReportUseCase {
  constructor(
    private reportRepository: ReportRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: ShareReportUseCaseRequest) {
    const access = await loadAccessibleReport(
      this.reportRepository,
      this.studentAccess,
      request.reportId,
      request.educatorId
    );
    if (!access.ok) return access;

    const share = { channel: request.channel, at: new Date() };
    await this.reportRepository.addShare(access.value.id, share);

    return success(access.value.share(share.channel, share.at));
  }
}
