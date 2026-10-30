import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { UpdateTaskNotebookUseCase } from "./update-task-notebook-use-case";
import { UpdateTaskNotebookSchema } from "../../schemas/update-task-notebook-schema";

export class UpdateTaskNotebookController extends BaseController {
  constructor(private useCase: UpdateTaskNotebookUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) {
      return this.unauthorized(res);
    }

    const validation = await UpdateTaskNotebookSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: user.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "TASK_NOTEBOOK_NOT_FOUND":
          return this.notFound(res, result.error);
        case "NOT_NOTEBOOK_OWNER":
          return this.forbidden(res, result.error);
        case "INVALID_TASK_NOTEBOOK_ID":
        case "INVALID_TASK_NOTEBOOK_DATA":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, result.error);
      }
    }
    return this.ok(res, result.value);
  }
}
