import { success, Uuid } from "@wave-telecom/framework/core";
import { Student } from "../../../../../domain/entities/student";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { mapSessionEvolutionToSummary } from "../../../../../infraestructure/mappers/map-session-evolution";
import { assertStudentOwnership } from "../../../plan/use-cases/plan-access";

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
    private studentRepository: StudentRepository
  ) {}

  // Filtra pelo dono atual do aluno (EV-01), não pelo autor gravado na
  // evolução: quem recebe o aluno vê o histórico dele.
  async execute(request: ListSessionEvolutionsUseCaseRequest) {
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
      students = await this.studentRepository.search({
        educatorId: request.educatorId,
      });
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

    return success(
      evolutions.map((evolution) =>
        mapSessionEvolutionToSummary(
          evolution,
          studentNames.get(evolution.studentId.value) ?? ""
        )
      )
    );
  }
}
