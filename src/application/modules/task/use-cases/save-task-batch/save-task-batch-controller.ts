import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { saveTaskBatchSchema } from "../../schemas/save-task-batch-schema";
import { SaveTaskBatchUseCase } from "./save-task-batch-use-case";

export class SaveTaskBatchController extends BaseController {
  constructor(private useCase: SaveTaskBatchUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) {
      return this.unauthorized(res);
    }

    const validation = await saveTaskBatchSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorEmail: user.email,
    });

    if (!result.ok) {
      switch (result.error) {
        case "EDUCATOR_NOT_FOUND":
          return this.notFound(res, "EDUCATOR_NOT_FOUND");
        case "EMPTY_TASK_LIST":
        case "INVALID_TASK_DATA":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.created(res, result.value);
  }
}
