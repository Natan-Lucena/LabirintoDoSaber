import { success, Uuid } from "@wave-telecom/framework/core";
import { FileStorage } from "../../../../services/file-storage";

interface UploadTaskMediaUseCaseRequest {
  file: Express.Multer.File;
}

export class UploadTaskMediaUseCase {
  constructor(private fileStorage: FileStorage) {}

  async execute(request: UploadTaskMediaUseCaseRequest) {
    const { url } = await this.fileStorage.saveFile({
      taskId: Uuid.random().value,
      file: request.file,
    });
    return success({ url });
  }
}
