import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ScaleApplication } from "../../../../domain/entities/scale-application";
import { ScaleTemplate } from "../../../../domain/entities/scale-template";
import { ScaleApplicationRepository } from "../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../domain/repositories/scale-template-repository";
import { StudentRepository } from "../../../../domain/repositories/student-repository";
import { assertStudentOwnership } from "../../plan/use-cases/plan-access";

// O que o controller precisa para montar a resposta: o escore é calculado
// com o template da versão gravada (AV-02).
export interface ScaleApplicationView {
  application: ScaleApplication;
  template: ScaleTemplate;
  studentName: string;
}

// O acesso é pelo dono atual do aluno (AV-01), não pelo educatorId gravado.
export async function loadOwnedApplication(
  applicationRepository: ScaleApplicationRepository,
  studentRepository: StudentRepository,
  applicationId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(applicationId)) return failure("APPLICATION_NOT_FOUND");

  const application = await applicationRepository.findById(new Uuid(applicationId));
  if (!application) return failure("APPLICATION_NOT_FOUND");

  const ownership = await assertStudentOwnership(
    studentRepository,
    application.studentId,
    educatorId
  );
  if (!ownership.ok) return ownership;

  return success({ application, student: ownership.value });
}

export async function loadOwnedApplicationWithTemplate(
  applicationRepository: ScaleApplicationRepository,
  templateRepository: ScaleTemplateRepository,
  studentRepository: StudentRepository,
  applicationId: string,
  educatorId: Uuid
) {
  const access = await loadOwnedApplication(
    applicationRepository,
    studentRepository,
    applicationId,
    educatorId
  );
  if (!access.ok) return access;
  const { application, student } = access.value;

  const template = await templateRepository.findById(application.templateId);
  if (!template) return failure("SCALE_NOT_FOUND");

  return success<ScaleApplicationView>({ application, template, studentName: student.name });
}
