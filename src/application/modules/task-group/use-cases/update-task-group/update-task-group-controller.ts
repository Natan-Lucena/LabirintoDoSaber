import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { UpdateTaskGroupUseCase } from "./update-task-group-use-case";
import { UpdateTaskGroupSchema } from "../../schemas/update-task-group-schema";

export class UpdateTaskGroupController extends BaseController {
  constructor(private useCase: UpdateTaskGroupUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) {
      return this.unauthorized(res);
    }

    const validation = await UpdateTaskGroupSchema.safeParseAsync(req.body);

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
        case "TASK_GROUP_NOT_FOUND":
          return this.notFound(res, result.error);
        case "NOT_GROUP_OWNER":
          return this.forbidden(res, result.error);
        case "INVALID_TASK_GROUP_ID":
        case "INVALID_TASK_GROUP_DATA":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, result.error);
      }
    }
    return this.ok(res, result.value);
  }
}
