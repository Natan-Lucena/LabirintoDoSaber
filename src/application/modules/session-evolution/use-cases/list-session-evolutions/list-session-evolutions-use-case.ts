import { success, Uuid } from "@wave-telecom/framework/core";
import { Student } from "../../../../../domain/entities/student";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { mapSessionEvolutionToSummary } from "../../../../../infraestructure/mappers/map-session-evolution";
import { loadAuthorNames } from "../../../../services/author-names";

export interface ListSessionEvolutionsUseCaseRequest {
  educatorId: Uuid;
  studentId?: string;
  from?: string;
  to?: string;
  limit: number;
}

export class ListSessionEvolutionsUseCase {
  constructor(
    private evolutionRepository: SessionEvolutionRepository,
    private studentAccess: StudentAccessService,
    private educatorRepository: EducatorRepository
  ) {}

  // Filtra pelos alunos que o educador acessa, dono atual ou compartilhado
  // (EV-01, EQ-11), não pelo autor gravado na evolução: quem recebe o aluno
  // vê o histórico dele.
  async execute(request: ListSessionEvolutionsUseCaseRequest) {
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
      students = accessible.map((item) => item.student);
    }

    const evolutions = await this.evolutionRepository.search({
      studentIds: students.map((student) => student.id),
      from: request.from,
      to: request.to,
      limit: request.limit,
    });

    const studentNames = new Map(
      students.map((student) => [student.id.value, student.name])
    );
    // EQ-12: nomes dos autores que não são quem lê, numa consulta só.
    const authorNames = await loadAuthorNames(
      this.educatorRepository,
      evolutions.map((evolution) => evolution.educatorId),
      request.educatorId
    );

    return success(
      evolutions.map((evolution) =>
        mapSessionEvolutionToSummary(
          evolution,
          studentNames.get(evolution.studentId.value) ?? "",
          authorNames.get(evolution.educatorId.value)
        )
      )
    );
  }
}
