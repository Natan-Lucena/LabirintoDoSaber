import { Uuid } from "@wave-telecom/framework/core";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { loadOwnedApplicationWithTemplate } from "../application-access";

export interface GetScaleApplicationUseCaseRequest {
  educatorId: Uuid;
  applicationId: string;
}

export class GetScaleApplicationUseCase {
  constructor(
    private applicationRepository: ScaleApplicationRepository,
    private templateRepository: ScaleTemplateRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: GetScaleApplicationUseCaseRequest) {
    return loadOwnedApplicationWithTemplate(
      this.applicationRepository,
      this.templateRepository,
      this.studentRepository,
      request.applicationId,
      request.educatorId
    );
  }
}
