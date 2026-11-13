import { success, Uuid } from "@wave-telecom/framework/core";
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

  async execute(request: ListSessionEvolutionsUseCaseRequest) {
    const studentId = request.studentId ? new Uuid(request.studentId) : undefined;

    if (studentId) {
      const ownership = await assertStudentOwnership(
        this.studentRepository,
        studentId,
        request.educatorId
      );
      if (!ownership.ok) return ownership;
    }

    const evolutions = await this.evolutionRepository.search({
      educatorId: request.educatorId,
      studentId,
      from: request.from,
      to: request.to,
      limit: request.limit,
    });

    const studentIds = [...new Set(evolutions.map((e) => e.studentId.value))];
    const students = await this.studentRepository.getByIds(
      studentIds.map((id) => new Uuid(id))
    );

    // Evoluções de alunos que trocaram de dono somem para o educador antigo.
    const ownedStudents = new Map(
      students
        .filter((student) => student.educatorId.value === request.educatorId.value)
        .map((student) => [student.id.value, student])
    );

    const summaries = evolutions
      .filter((evolution) => ownedStudents.has(evolution.studentId.value))
      .map((evolution) =>
        mapSessionEvolutionToSummary(
          evolution,
          ownedStudents.get(evolution.studentId.value)!.name
        )
      );

    return success(summaries);
  }
}
