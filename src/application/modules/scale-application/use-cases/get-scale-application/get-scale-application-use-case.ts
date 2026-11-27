import { Uuid } from "@wave-telecom/framework/core";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleApplicationWithTemplate } from "../application-access";

export interface GetScaleApplicationUseCaseRequest {
  educatorId: Uuid;
  applicationId: string;
}

export class GetScaleApplicationUseCase {
  constructor(
    private applicationRepository: ScaleApplicationRepository,
    private templateRepository: ScaleTemplateRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: GetScaleApplicationUseCaseRequest) {
    return loadAccessibleApplicationWithTemplate(
      this.applicationRepository,
      this.templateRepository,
      this.studentAccess,
      request.applicationId,
      request.educatorId
    );
  }
}
