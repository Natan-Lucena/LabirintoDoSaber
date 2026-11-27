import { success, Uuid } from "@wave-telecom/framework/core";
import { PlanStatus, PlanType } from "../../../../../domain/entities/plan";
import { Student } from "../../../../../domain/entities/student";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { mapPlanToSummary } from "../../../../../infraestructure/mappers/map-plan";
import { loadAuthorNames } from "../../../../services/author-names";

export interface ListPlansUseCaseRequest {
  educatorId: Uuid;
  studentId?: string;
  status?: PlanStatus;
  type?: PlanType;
}

export class ListPlansUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentAccess: StudentAccessService,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: ListPlansUseCaseRequest) {
    // Planos dos alunos que o educador acessa (dono ou compartilhado, EQ-11),
    // de qualquer autor. Aluno que trocou de dono some para o antigo.
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

    if (students.length === 0) return success([]);

    const studentsById = new Map(students.map((student) => [student.id.value, student]));
    const plans = await this.planRepository.search({
      studentIds: students.map((student) => student.id),
      status: request.status,
      type: request.type,
    });

    // EQ-12: nome dos autores que não são quem lê, numa consulta só.
    const authorNames = await loadAuthorNames(
      this.educatorRepository,
      plans.map((plan) => plan.educatorId),
      request.educatorId
    );

    const summaries = plans
      .filter((plan) => studentsById.has(plan.studentId.value))
      .sort(
        (a, b) =>
          Number(b.status === PlanStatus.ACTIVE) -
            Number(a.status === PlanStatus.ACTIVE) ||
          b.updatedAt.getTime() - a.updatedAt.getTime()
      )
      .map((plan) =>
        mapPlanToSummary(
          plan,
          studentsById.get(plan.studentId.value)!.name,
          authorNames.get(plan.educatorId.value)
        )
      );

    return success(summaries);
  }
}
