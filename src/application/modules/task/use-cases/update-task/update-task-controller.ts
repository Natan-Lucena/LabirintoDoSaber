import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { UpdateTaskUseCase } from "./update-task-use-case";
import { updateTaskSchema } from "../../schemas/update-task-schemas";
import { sendTaskError } from "../task-rules";

export class UpdateTaskController extends BaseController {
  constructor(private useCase: UpdateTaskUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const validation = await updateTaskSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({ ...validation.data, educatorId: user.id });

    if (!result.ok) return sendTaskError(res, result.error);

    return this.ok(res, result.value);
  }
}
