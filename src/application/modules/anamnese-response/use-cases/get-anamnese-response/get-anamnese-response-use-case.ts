import { success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleResponse } from "../response-access";

interface GetAnamneseResponseUseCaseRequest {
  responseId: string;
  educatorId: Uuid;
}

export class GetAnamneseResponseUseCase {
  constructor(
    private responseRepository: AnamneseResponseRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: GetAnamneseResponseUseCaseRequest) {
    const access = await loadAccessibleResponse(
      this.responseRepository,
      this.studentAccess,
      request.responseId,
      request.educatorId
    );
    if (!access.ok) return access;

    return success(access.value.response);
  }
}
