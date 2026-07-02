import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { generateTasksSchema } from "../../schemas/generate-tasks-schema";
import { GenerateTasksUseCase } from "./generate-tasks-use-case";

export class GenerateTasksController extends BaseController {
  constructor(private useCase: GenerateTasksUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) {
      return this.unauthorized(res);
    }

    const validation = await generateTasksSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute(validation.data);

    if (!result.ok) {
      switch (result.error) {
        case "INVALID_QUANTITY":
          return this.clientError(res, "INVALID_QUANTITY");
        case "AI_INVALID_OUTPUT":
        case "AI_GENERATION_FAILED":
          return this.fail(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
