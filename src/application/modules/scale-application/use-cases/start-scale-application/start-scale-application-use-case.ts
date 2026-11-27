import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ScaleApplication } from "../../../../../domain/entities/scale-application";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
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
    private studentAccess: StudentAccessService,
    private appointmentRepository: AppointmentRepository
  ) {}

  async execute(request: StartScaleApplicationUseCaseRequest) {
    // Arquivado não recebe aplicação nova (PA-04).
    const access = await this.studentAccess.assertActiveStudentAccess(
      new Uuid(request.studentId),
      request.educatorId
    );
    if (!access.ok) return access;
    const student = access.value;

    const template = await this.templateRepository.findById(new Uuid(request.templateId));
    if (!template) return failure("SCALE_NOT_FOUND");

    // AV-02: só a maior versão publicada, e ativa, aceita aplicação nova.
    const latest = await this.templateRepository.findLatestByCode(template.code);
    if (!latest || latest.id.value !== template.id.value) return failure("SCALE_INACTIVE");

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
      // Qualquer atendimento do aluno: o compartilhado usa os do dono (EQ-11).
      if (!appointment || appointment.studentId.value !== student.id.value) {
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
