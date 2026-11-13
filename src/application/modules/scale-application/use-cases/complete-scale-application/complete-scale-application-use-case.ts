import { success, Uuid } from "@wave-telecom/framework/core";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import {
  loadOwnedApplicationWithTemplate,
  ScaleApplicationView,
} from "../application-access";

export interface CompleteScaleApplicationUseCaseRequest {
  educatorId: Uuid;
  applicationId: string;
}

export class CompleteScaleApplicationUseCase {
  constructor(
    private applicationRepository: ScaleApplicationRepository,
    private templateRepository: ScaleTemplateRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: CompleteScaleApplicationUseCaseRequest) {
    const access = await loadOwnedApplicationWithTemplate(
      this.applicationRepository,
      this.templateRepository,
      this.studentRepository,
      request.applicationId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { application, template, studentName } = access.value;

    const completed = application.complete(template);
    if (!completed.ok) return completed;

    await this.applicationRepository.save(completed.value);

    return success<ScaleApplicationView>({
      application: completed.value,
      template,
      studentName,
    });
  }
}
