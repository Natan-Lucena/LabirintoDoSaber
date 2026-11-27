import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleApplication } from "../application-access";

export interface DeleteScaleApplicationUseCaseRequest {
  educatorId: Uuid;
  applicationId: string;
}

export class DeleteScaleApplicationUseCase {
  constructor(
    private applicationRepository: ScaleApplicationRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: DeleteScaleApplicationUseCaseRequest) {
    const access = await loadAccessibleApplication(
      this.applicationRepository,
      this.studentAccess,
      request.applicationId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { application } = access.value;

    // AV-08: só rascunho pode ser excluído.
    if (!application.canBeDeleted) return failure("APPLICATION_NOT_EDITABLE");

    await this.applicationRepository.delete(application.id);

    return success(undefined);
  }
}
