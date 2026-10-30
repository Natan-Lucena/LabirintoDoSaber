import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { DeleteTaskGroupUseCase } from "./delete-task-group-use-case";
import { deleteTaskGroupSchema } from "../../schemas/delete-task-group-schema";
import { Uuid } from "@wave-telecom/framework/core";

export class DeleteTaskGroupController extends BaseController {
  constructor(private useCase: DeleteTaskGroupUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) {
      return this.unauthorized(res);
    }

    const validation = await deleteTaskGroupSchema.safeParseAsync(req.params);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      taskGroupId: new Uuid(validation.data.taskGroupId),
      educatorId: user.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "TASK_GROUP_NOT_FOUND":
          return this.notFound(res, result.error);
        case "NOT_GROUP_OWNER":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, result.error);
      }
    }

    return this.ok(res, null);
  }
}
