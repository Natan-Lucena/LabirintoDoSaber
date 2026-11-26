import { failure, success, Uuid } from "@wave-telecom/framework/core";
import {
  Plan,
  PlanGoalInput,
  PlanSource,
  PlanType,
} from "../../../../../domain/entities/plan";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";

export interface CreatePlanUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
  type: PlanType;
  source: PlanSource;
  title: string;
  generalObjective: string;
  professionalNotes?: string;
  focus?: string;
  consideredDifficulties?: string[];
  startDate?: string;
  endDate?: string;
  nextReviewDate?: string;
  parentPlanId?: string;
  sessionDate?: string;
  appointmentId?: string;
  goals: PlanGoalInput[];
}

export class CreatePlanUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentAccess: StudentAccessService,
    private appointmentRepository: AppointmentRepository
  ) {}

  async execute(request: CreatePlanUseCaseRequest) {
    const studentId = new Uuid(request.studentId);

    const access = await this.studentAccess.assertStudentAccess(studentId, request.educatorId);
    if (!access.ok) return access;

    if (request.type === PlanType.PDI) {
      const activePdi = await this.planRepository.findActivePdi(studentId);
      if (activePdi) {
        return failure({
          code: "ACTIVE_PDI_ALREADY_EXISTS",
          activePlanId: activePdi.id.value,
        });
      }
    }

    const parentPlanId = request.parentPlanId
      ? new Uuid(request.parentPlanId)
      : undefined;
    const appointmentId = request.appointmentId
      ? new Uuid(request.appointmentId)
      : undefined;

    if (request.type === PlanType.PE && parentPlanId) {
      const parentPlan = await this.planRepository.findById(parentPlanId);
      if (
        !parentPlan ||
        parentPlan.type !== PlanType.PDI ||
        parentPlan.studentId.value !== studentId.value
      ) {
        return failure("INVALID_PARENT_PLAN");
      }
    }

    // Atendimento do aluno, de qualquer educador com acesso a ele (EQ-11).
    if (request.type === PlanType.PE && appointmentId) {
      const appointment = await this.appointmentRepository.findById(appointmentId);
      if (!appointment || appointment.studentId.value !== studentId.value) {
        return failure("INVALID_APPOINTMENT");
      }
    }

    const planResult = Plan.create({
      educatorId: request.educatorId,
      studentId,
      type: request.type,
      source: request.source,
      title: request.title,
      generalObjective: request.generalObjective,
      professionalNotes: request.professionalNotes,
      focus: request.focus,
      consideredDifficulties: request.consideredDifficulties,
      startDate: request.startDate,
      endDate: request.endDate,
      nextReviewDate: request.nextReviewDate,
      parentPlanId,
      sessionDate: request.sessionDate,
      appointmentId,
      goals: request.goals,
    });
    if (!planResult.ok) return planResult;

    await this.planRepository.save(planResult.value);

    return success(planResult.value);
  }
}
