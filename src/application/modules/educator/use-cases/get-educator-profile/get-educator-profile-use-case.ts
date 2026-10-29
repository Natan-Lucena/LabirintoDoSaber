import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";

interface GetEducatorProfileUseCaseRequest {
  educatorId: Uuid;
}

interface EducatorProfileResponse {
  id: string;
  name: string;
  email: string;
  photoUrl: string | undefined;
  contact: string | undefined;
  profession: string | undefined;
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

    const educatorDetails: EducatorProfileResponse = {
      id: educator.id.toString(),
      name: educator.name,
      email: educator.email,
      photoUrl: educator.photoUrl,
      contact: educator.contact,
      profession: educator.profession,
    };

    return success(educatorDetails);
  }
}
