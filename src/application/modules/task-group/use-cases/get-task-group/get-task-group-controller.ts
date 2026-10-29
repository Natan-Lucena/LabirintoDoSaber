import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GetTaskGroupUseCase } from "./get-task-group-use-case";

export class GetTaskGroupController extends BaseController {
  constructor(private useCase: GetTaskGroupUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) {
      return this.unauthorized(res);
    }

    const result = await this.useCase.execute({
      taskGroupId: String(req.params.id),
      educatorId: user.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "TASK_GROUP_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, result.error);
      }
    }

    return this.ok(res, result.value);
  }
}
