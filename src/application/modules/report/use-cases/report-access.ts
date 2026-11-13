import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ReportRepository } from "../../../../domain/repositories/report-repository";
import { StudentRepository } from "../../../../domain/repositories/student-repository";
import { assertStudentOwnership } from "../../plan/use-cases/plan-access";

// O acesso é pelo dono atual do aluno, não pelo educatorId gravado (§1).
export async function loadOwnedReport(
  reportRepository: ReportRepository,
  studentRepository: StudentRepository,
  reportId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(reportId)) return failure("REPORT_NOT_FOUND");

  const report = await reportRepository.findById(new Uuid(reportId));
  if (!report) return failure("REPORT_NOT_FOUND");

  const ownership = await assertStudentOwnership(
    studentRepository,
    report.studentId,
    educatorId
  );
  if (!ownership.ok) return ownership;

  return success(report);
}
