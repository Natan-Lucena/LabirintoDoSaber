import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GetTaskByIdUseCase } from "./get-task-by-id-use-case";
import { getTaskByIdSchema } from "../../schemas/get-task-by-id-schemas";
import { sendTaskError } from "../task-rules";

export class GetTaskByIdController extends BaseController {
  constructor(private useCase: GetTaskByIdUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const validation = await getTaskByIdSchema.safeParseAsync(req.params);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({ taskId: validation.data.id });

    if (!result.ok) return sendTaskError(res, result.error);

    return this.ok(res, result.value);
  }
}
