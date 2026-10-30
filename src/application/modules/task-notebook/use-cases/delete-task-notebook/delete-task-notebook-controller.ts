import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { DeleteTaskNotebookUseCase } from "./delete-task-notebook-use-case";
import { DeleteTaskNotebookSchema } from "../../schemas/delete-task-notebook-schema";
import { Uuid } from "@wave-telecom/framework/core";

export class DeleteTaskNotebookController extends BaseController {
  constructor(private useCase: DeleteTaskNotebookUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) {
      return this.unauthorized(res);
    }

    const validation = await DeleteTaskNotebookSchema.safeParseAsync(req.params);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      taskNotebookId: new Uuid(validation.data.taskNotebookId),
      educatorId: user.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "TASK_NOTEBOOK_NOT_FOUND":
          return this.notFound(res, result.error);
        case "NOT_NOTEBOOK_OWNER":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, result.error);
      }
    }

    return this.ok(res, null);
  }
}
