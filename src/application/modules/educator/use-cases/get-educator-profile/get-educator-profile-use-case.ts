import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { mapEducatorToResponse } from "../../../../../infraestructure/mappers/map-educator";

interface GetEducatorProfileUseCaseRequest {
  educatorId: Uuid;
}

export class GetEducatorProfileUseCase {
  constructor(private educatorRepository: EducatorRepository) {}

  async execute(request: GetEducatorProfileUseCaseRequest) {
    const educatorUuid = request.educatorId;

    const educators = await this.educatorRepository.search({
      id: educatorUuid,
    });

    if (!educators || educators.length === 0) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    const educator = educators[0];

    return success(mapEducatorToResponse(educator));
  }
}
