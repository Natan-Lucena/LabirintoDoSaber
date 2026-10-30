import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { mapEducatorToResponse } from "../../../../../infraestructure/mappers/map-educator";
import { FileStorage } from "../../../../services/file-storage";

interface EducatorUpdateProfilePictureRequest {
  educatorEmail: string;
  photo: Express.Multer.File;
}

export class EducatorUpdateProfilePictureUseCase {
  constructor(
    private fileStorage: FileStorage,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(params: EducatorUpdateProfilePictureRequest) {
    const educator = await this.educatorRepository.getByEmail(
      params.educatorEmail
    );

    if (!educator) {
      return failure("EDUCATOR_DOES_NOT_EXISTS");
    }

    const fileResult = await this.fileStorage.saveFile({
      taskId: educator.id.value,
      file: params.photo,
    });

    educator.updateProfilePicture(fileResult.url);

    const result = await this.educatorRepository.save(educator);
    return success(mapEducatorToResponse(result));
  }
}
