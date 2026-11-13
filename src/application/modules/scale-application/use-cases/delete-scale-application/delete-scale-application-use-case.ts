import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { loadOwnedApplication } from "../application-access";

export interface DeleteScaleApplicationUseCaseRequest {
  educatorId: Uuid;
  applicationId: string;
}

export class DeleteScaleApplicationUseCase {
  constructor(
    private applicationRepository: ScaleApplicationRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: DeleteScaleApplicationUseCaseRequest) {
    const access = await loadOwnedApplication(
      this.applicationRepository,
      this.studentRepository,
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
