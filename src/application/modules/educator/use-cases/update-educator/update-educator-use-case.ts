import { failure, success } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";

interface UpdateEducatorUseCaseRequest {
  email: string;
  newName?: string;
  newContact?: string;
  newProfession?: string;
}

export class UpdateEducatorUseCase {
  constructor(private educatorRepository: EducatorRepository) {}

  async execute(request: UpdateEducatorUseCaseRequest) {
    const educator = await this.educatorRepository.getByEmail(request.email);

    if (!educator) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    educator.update({
      name: request.newName ?? educator.name,
      contact: request.newContact ?? educator.contact,
      profession: request.newProfession ?? educator.profession,
    });

    const result = await this.educatorRepository.save(educator);

    return success(result);
  }
}
