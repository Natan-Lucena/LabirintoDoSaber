import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";

interface GetAnamneseResponseUseCaseRequest {
  responseId: string;
  educatorId: Uuid;
}

export class GetAnamneseResponseUseCase {
  constructor(private responseRepository: AnamneseResponseRepository) {}

  async execute(request: GetAnamneseResponseUseCaseRequest) {
    const response = await this.responseRepository.findById(
      new Uuid(request.responseId)
    );

    if (!response) {
      return failure("RESPONSE_NOT_FOUND");
    }

    if (response.educatorId.value !== request.educatorId.value) {
      return failure("UNAUTHORIZED");
    }

    return success(response);
  }
}
