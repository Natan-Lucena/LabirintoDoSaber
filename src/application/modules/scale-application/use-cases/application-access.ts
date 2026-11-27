import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ScaleApplication } from "../../../../domain/entities/scale-application";
import { ScaleTemplate } from "../../../../domain/entities/scale-template";
import { ScaleApplicationRepository } from "../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../domain/repositories/scale-template-repository";
import { StudentAccessService } from "../../../../domain/services/student-access-service";

// O que o controller precisa para montar a resposta: o escore é calculado
// com o template da versão gravada (AV-02).
export interface ScaleApplicationView {
  application: ScaleApplication;
  template: ScaleTemplate;
  studentName: string;
}

// O acesso é pelo aluno, dono atual ou compartilhado (AV-01, EQ-11), não pelo
// educatorId gravado.
export async function loadAccessibleApplication(
  applicationRepository: ScaleApplicationRepository,
  studentAccess: StudentAccessService,
  applicationId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(applicationId)) return failure("APPLICATION_NOT_FOUND");

  const application = await applicationRepository.findById(new Uuid(applicationId));
  if (!application) return failure("APPLICATION_NOT_FOUND");

  const access = await studentAccess.assertStudentAccess(application.studentId, educatorId);
  if (!access.ok) return access;

  return success({ application, student: access.value });
}

export async function loadAccessibleApplicationWithTemplate(
  applicationRepository: ScaleApplicationRepository,
  templateRepository: ScaleTemplateRepository,
  studentAccess: StudentAccessService,
  applicationId: string,
  educatorId: Uuid
) {
  const access = await loadAccessibleApplication(
    applicationRepository,
    studentAccess,
    applicationId,
    educatorId
  );
  if (!access.ok) return access;
  const { application, student } = access.value;

  const template = await templateRepository.findById(application.templateId);
  if (!template) return failure("SCALE_NOT_FOUND");

  return success<ScaleApplicationView>({ application, template, studentName: student.name });
}
