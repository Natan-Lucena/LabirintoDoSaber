import { success, Uuid } from "@wave-telecom/framework/core";
import { Student } from "../../../../../domain/entities/student";
import { ReportRepository } from "../../../../../domain/repositories/report-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { loadAuthorNames } from "../../../../services/author-names";
import { mapReportToSummary } from "../../../../../infraestructure/mappers/map-report";

export interface ListReportsUseCaseRequest {
  educatorId: Uuid;
  studentId?: string;
  limit: number;
}

export class ListReportsUseCase {
  constructor(
    private reportRepository: ReportRepository,
    private studentAccess: StudentAccessService,
    private educatorRepository: EducatorRepository
  ) {}

  // Filtra pelos alunos que o educador acessa, dono ou compartilhado (EQ-11),
  // não pelo autor gravado.
  async execute(request: ListReportsUseCaseRequest) {
    let students: Student[];

    if (request.studentId) {
      const access = await this.studentAccess.assertStudentAccess(
        new Uuid(request.studentId),
        request.educatorId
      );
      if (!access.ok) return access;
      students = [access.value];
    } else {
      const accessible = await this.studentAccess.listAccessibleStudents(request.educatorId);
      students = accessible.map(({ student }) => student);
    }

    const reports = await this.reportRepository.search({
      studentIds: students.map((student) => student.id),
      limit: request.limit,
    });

    // EQ-12: nomes dos autores que não são quem lê, numa consulta só.
    const authorNames = await loadAuthorNames(
      this.educatorRepository,
      reports.map((report) => report.educatorId),
      request.educatorId
    );

    return success(
      reports.map((report) =>
        mapReportToSummary(report, authorNames.get(report.educatorId.value))
      )
    );
  }
}
