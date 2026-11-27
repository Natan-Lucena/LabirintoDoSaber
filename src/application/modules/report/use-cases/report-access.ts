import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ReportRepository } from "../../../../domain/repositories/report-repository";
import { StudentAccessService } from "../../../../domain/services/student-access-service";

// O acesso é pelo aluno, dono atual ou compartilhado (§1, EQ-11), não pelo
// educatorId gravado.
export async function loadAccessibleReport(
  reportRepository: ReportRepository,
  studentAccess: StudentAccessService,
  reportId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(reportId)) return failure("REPORT_NOT_FOUND");

  const report = await reportRepository.findById(new Uuid(reportId));
  if (!report) return failure("REPORT_NOT_FOUND");

  const access = await studentAccess.assertStudentAccess(report.studentId, educatorId);
  if (!access.ok) return access;

  return success(report);
}
