import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { StudentAnalysisReportRepository } from "../../../../../domain/repositories/student-analysis-report-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";

export interface ListStudentAnalysisHistoryRequest {
  studentId: string;
  educatorId: Uuid;
}

export class ListStudentAnalysisHistoryUseCase {
  constructor(
    private studentAnalysisReportRepository: StudentAnalysisReportRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: ListStudentAnalysisHistoryRequest) {
    // EQ-11: dono ou compartilhado.
    if (!Uuid.isValid(request.studentId)) return failure("STUDENT_NOT_FOUND" as const);
    const access = await this.studentAccess.assertStudentAccess(
      new Uuid(request.studentId),
      request.educatorId
    );
    if (!access.ok) return access;

    return success(
      await this.studentAnalysisReportRepository.listByStudentId(access.value.id)
    );
  }
}
