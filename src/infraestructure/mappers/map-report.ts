import {
  Report,
  ReportAudience,
  ReportContent,
  ReportSummaryProps,
} from "../../domain/entities/report";
import { shortDisplayName } from "../../domain/utils/person-name";

const mapShare = (share: ReportSummaryProps["shares"][number]) => ({
  channel: share.channel,
  at: share.at,
});

// RP-02: para a escola, o nome sai abreviado também no topo. Os relatórios
// SCHOOL gravados antes da regra têm o nome completo no documento; abreviar na
// leitura é idempotente ("Ana S." continua "Ana S.").
const studentNameFor = (report: ReportSummaryProps) =>
  report.audience === ReportAudience.SCHOOL
    ? shortDisplayName(report.studentName)
    : report.studentName;

function contentFor(report: Report): ReportContent {
  const { content } = report;
  if (report.audience !== ReportAudience.SCHOOL || !content.patient) return content;
  return {
    ...content,
    patient: { ...content.patient, displayName: shortDisplayName(content.patient.displayName) },
  };
}

// authorName: nome do autor quando não é quem lê (EQ-12); ausente do JSON
// quando o autor é o leitor.
export function mapReportToResponse(report: Report, authorName?: string) {
  return {
    id: report.id.value,
    studentId: report.studentId.value,
    studentName: studentNameFor(report),
    educatorId: report.educatorId.value,
    ...(authorName ? { authorName } : {}),
    type: report.type,
    audience: report.audience,
    period: { from: report.periodFrom, to: report.periodTo },
    sections: report.sections,
    content: contentFor(report),
    synthesisFailed: report.synthesisFailed,
    createdAt: report.createdAt,
    shares: report.shares.map(mapShare),
  };
}

// Histórico: sem o conteúdo, com o último envio.
export function mapReportToSummary(report: ReportSummaryProps, authorName?: string) {
  const lastShare = report.shares[report.shares.length - 1];
  return {
    id: report.id.value,
    studentId: report.studentId.value,
    studentName: studentNameFor(report),
    educatorId: report.educatorId.value,
    ...(authorName ? { authorName } : {}),
    type: report.type,
    audience: report.audience,
    period: { from: report.periodFrom, to: report.periodTo },
    sections: report.sections,
    synthesisFailed: report.synthesisFailed,
    createdAt: report.createdAt,
    lastShare: lastShare ? mapShare(lastShare) : undefined,
  };
}
