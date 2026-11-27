import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { DeleteTaskUseCase } from "./delete-task-use-case";
import { deleteTaskSchema } from "../../schemas/delete-task-schemas";
import { sendTaskError } from "../task-rules";

export class DeleteTaskController extends BaseController {
  constructor(private useCase: DeleteTaskUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const validation = await deleteTaskSchema.safeParseAsync(req.params);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      taskId: validation.data.id,
      educatorId: user.id,
    });

    if (!result.ok) return sendTaskError(res, result.error);

    return this.ok(res, null);
  }
}
