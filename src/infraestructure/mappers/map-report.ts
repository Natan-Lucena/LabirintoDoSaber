import { Report, ReportSummaryProps } from "../../domain/entities/report";

const mapShare = (share: ReportSummaryProps["shares"][number]) => ({
  channel: share.channel,
  at: share.at,
});

export function mapReportToResponse(report: Report) {
  return {
    id: report.id.value,
    studentId: report.studentId.value,
    studentName: report.studentName,
    educatorId: report.educatorId.value,
    type: report.type,
    audience: report.audience,
    period: { from: report.periodFrom, to: report.periodTo },
    sections: report.sections,
    content: report.content,
    synthesisFailed: report.synthesisFailed,
    createdAt: report.createdAt,
    shares: report.shares.map(mapShare),
  };
}

// Histórico: sem o conteúdo, com o último envio.
export function mapReportToSummary(report: ReportSummaryProps) {
  const lastShare = report.shares[report.shares.length - 1];
  return {
    id: report.id.value,
    studentId: report.studentId.value,
    studentName: report.studentName,
    educatorId: report.educatorId.value,
    type: report.type,
    audience: report.audience,
    period: { from: report.periodFrom, to: report.periodTo },
    sections: report.sections,
    synthesisFailed: report.synthesisFailed,
    createdAt: report.createdAt,
    lastShare: lastShare ? mapShare(lastShare) : undefined,
  };
}
