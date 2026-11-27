import { success, Uuid } from "@wave-telecom/framework/core";
import { ScaleAnswer } from "../../../../../domain/entities/scale-template";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import {
  loadAccessibleApplicationWithTemplate,
  ScaleApplicationView,
} from "../application-access";

export interface SaveScaleAnswersUseCaseRequest {
  educatorId: Uuid;
  applicationId: string;
  answers: ScaleAnswer[];
}

export class SaveScaleAnswersUseCase {
  constructor(
    private applicationRepository: ScaleApplicationRepository,
    private templateRepository: ScaleTemplateRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: SaveScaleAnswersUseCaseRequest) {
    const access = await loadAccessibleApplicationWithTemplate(
      this.applicationRepository,
      this.templateRepository,
      this.studentAccess,
      request.applicationId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { application, template, studentName } = access.value;

    const updated = application.saveAnswers(template, request.answers);
    if (!updated.ok) return updated;

    await this.applicationRepository.save(updated.value);

    return success<ScaleApplicationView>({
      application: updated.value,
      template,
      studentName,
    });
  }
}
