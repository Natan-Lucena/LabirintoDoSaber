import { success, Uuid } from "@wave-telecom/framework/core";
import { Student } from "../../../../../domain/entities/student";
import { ReportRepository } from "../../../../../domain/repositories/report-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { mapReportToSummary } from "../../../../../infraestructure/mappers/map-report";
import { assertStudentOwnership } from "../../../plan/use-cases/plan-access";

export interface ListReportsUseCaseRequest {
  educatorId: Uuid;
  studentId?: string;
  limit: number;
}

export class ListReportsUseCase {
  constructor(
    private reportRepository: ReportRepository,
    private studentRepository: StudentRepository
  ) {}

  // Filtra pelo dono atual do aluno, não pelo autor gravado.
  async execute(request: ListReportsUseCaseRequest) {
    let students: Student[];

    if (request.studentId) {
      const ownership = await assertStudentOwnership(
        this.studentRepository,
        new Uuid(request.studentId),
        request.educatorId
      );
      if (!ownership.ok) return ownership;
      students = [ownership.value];
    } else {
      students = await this.studentRepository.search({ educatorId: request.educatorId });
    }

    const reports = await this.reportRepository.search({
      studentIds: students.map((student) => student.id),
      limit: request.limit,
    });

    return success(reports.map(mapReportToSummary));
  }
}
