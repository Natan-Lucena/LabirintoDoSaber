import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { UploadTaskMediaUseCase } from "./upload-task-media-use-case";

export class UploadTaskMediaController extends BaseController {
  constructor(private useCase: UploadTaskMediaUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) {
      return this.unauthorized(res);
    }

    const file = req.file;
    if (!file) {
      return this.clientError(res, "FILE_REQUIRED");
    }

    const result = await this.useCase.execute({ file });

    return this.ok(res, result.value);
  }
}
