import { success, Uuid } from "@wave-telecom/framework/core";
import { FileStorage } from "../../../../services/file-storage";

interface UploadAnamneseFileUseCaseRequest {
  file: Express.Multer.File;
}

export class UploadAnamneseFileUseCase {
  constructor(private fileStorage: FileStorage) {}

  async execute(request: UploadAnamneseFileUseCaseRequest) {
    const { url } = await this.fileStorage.saveFile({
      taskId: Uuid.random().value,
      file: request.file,
    });
    return success({ url });
  }
}
