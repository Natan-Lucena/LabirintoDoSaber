import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { UploadAnamneseFileUseCase } from "./upload-anamnese-file-use-case";

export class UploadAnamneseFileController extends BaseController {
  constructor(private useCase: UploadAnamneseFileUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    if (!req.file) {
      return this.clientError(res, "FILE_REQUIRED");
    }

    const result = await this.useCase.execute({ file: req.file });

    return this.ok(res, result.value);
  }
}
