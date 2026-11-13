import { success, Uuid } from "@wave-telecom/framework/core";
import { ScaleAnswer } from "../../../../../domain/entities/scale-template";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import {
  loadOwnedApplicationWithTemplate,
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
    private studentRepository: StudentRepository
  ) {}

  async execute(request: SaveScaleAnswersUseCaseRequest) {
    const access = await loadOwnedApplicationWithTemplate(
      this.applicationRepository,
      this.templateRepository,
      this.studentRepository,
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
