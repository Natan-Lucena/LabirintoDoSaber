import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { CreateTaskGroupUseCase } from "./create-task-group-use-case";
import { Request, Response } from "express";
import { CreateTaskGroupSchema } from "../../schemas/create-task-group.schema";

export class CreateTaskGroupController extends BaseController {
  constructor(private useCase: CreateTaskGroupUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) {
      return this.unauthorized(res);
    }

    const validation = await CreateTaskGroupSchema.safeParseAsync(req.body);

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
        case "PRINTABLE_NOT_PLAYABLE":
          return this.clientError(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "TASK_NOT_FOUND":
          return this.notFound(res, "TASK_NOT_FOUND");
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }
    return this.ok(res, result.value);
  }
}
