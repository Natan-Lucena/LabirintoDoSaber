import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ScaleApplication } from "../../../../../domain/entities/scale-application";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { assertStudentOwnership } from "../../../plan/use-cases/plan-access";
import { ScaleApplicationView } from "../application-access";

export interface StartScaleApplicationUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
  templateId: string;
  appointmentId?: string;
}

export class StartScaleApplicationUseCase {
  constructor(
    private applicationRepository: ScaleApplicationRepository,
    private templateRepository: ScaleTemplateRepository,
    private studentRepository: StudentRepository,
    private appointmentRepository: AppointmentRepository
  ) {}

  async execute(request: StartScaleApplicationUseCaseRequest) {
    const ownership = await assertStudentOwnership(
      this.studentRepository,
      new Uuid(request.studentId),
      request.educatorId
    );
    if (!ownership.ok) return ownership;
    const student = ownership.value;

    const template = await this.templateRepository.findById(new Uuid(request.templateId));
    if (!template) return failure("SCALE_NOT_FOUND");

    const appointmentId = request.appointmentId
      ? new Uuid(request.appointmentId)
      : undefined;

    const started = ScaleApplication.start({
      template,
      studentId: student.id,
      educatorId: request.educatorId,
      appointmentId,
    });
    if (!started.ok) return started;

    // AV-03: um rascunho por aluno e escala. A corrida entre dois inícios
    // simultâneos é aceita; o app retoma o mais recente.
    const draft = await this.applicationRepository.findDraft(student.id, template.code);
    if (draft) {
      return failure({
        code: "DRAFT_ALREADY_EXISTS" as const,
        applicationId: draft.id.value,
      });
    }

    if (appointmentId) {
      const appointment = await this.appointmentRepository.findById(appointmentId);
      if (
        !appointment ||
        appointment.educatorId.value !== request.educatorId.value ||
        appointment.studentId.value !== student.id.value
      ) {
        return failure("INVALID_APPOINTMENT");
      }
    }

    await this.applicationRepository.save(started.value);

    return success<ScaleApplicationView>({
      application: started.value,
      template,
      studentName: student.name,
    });
  }
}
