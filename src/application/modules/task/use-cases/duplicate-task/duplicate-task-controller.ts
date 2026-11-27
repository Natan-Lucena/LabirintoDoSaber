import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { DuplicateTaskUseCase } from "./duplicate-task-use-case";
import { sendTaskError } from "../task-rules";

export class DuplicateTaskController extends BaseController {
  constructor(private useCase: DuplicateTaskUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const result = await this.useCase.execute({
      taskId: String(req.params.id),
      educatorId: user.id,
    });

    if (!result.ok) return sendTaskError(res, result.error);

    return this.created(res, result.value);
  }
}
