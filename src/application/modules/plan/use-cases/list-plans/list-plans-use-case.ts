import { success, Uuid } from "@wave-telecom/framework/core";
import { PlanStatus, PlanType } from "../../../../../domain/entities/plan";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { mapPlanToSummary } from "../../../../../infraestructure/mappers/map-plan";
import { assertStudentOwnership } from "../plan-access";

export interface ListPlansUseCaseRequest {
  educatorId: Uuid;
  studentId?: string;
  status?: PlanStatus;
  type?: PlanType;
}

export class ListPlansUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: ListPlansUseCaseRequest) {
    const studentId = request.studentId ? new Uuid(request.studentId) : undefined;

    if (studentId) {
      const ownership = await assertStudentOwnership(
        this.studentRepository,
        studentId,
        request.educatorId
      );
      if (!ownership.ok) return ownership;
    }

    const plans = await this.planRepository.search({
      educatorId: request.educatorId,
      studentId,
      status: request.status,
      type: request.type,
    });

    const studentIds = [...new Set(plans.map((plan) => plan.studentId.value))];
    const students = await this.studentRepository.getByIds(
      studentIds.map((id) => new Uuid(id))
    );

    // Planos de alunos que trocaram de dono somem para o educador antigo.
    const ownedStudents = new Map(
      students
        .filter((student) => student.educatorId.value === request.educatorId.value)
        .map((student) => [student.id.value, student])
    );

    const summaries = plans
      .filter((plan) => ownedStudents.has(plan.studentId.value))
      .sort(
        (a, b) =>
          Number(b.status === PlanStatus.ACTIVE) -
            Number(a.status === PlanStatus.ACTIVE) ||
          b.updatedAt.getTime() - a.updatedAt.getTime()
      )
      .map((plan) =>
        mapPlanToSummary(plan, ownedStudents.get(plan.studentId.value)!.name)
      );

    return success(summaries);
  }
}
