import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { ListTasksUseCase } from "./list-tasks-use-case";
import { listTasksSchema } from "../../schemas/list-tasks-schemas";
import { Uuid } from "@wave-telecom/framework/core";

export class ListTasksController extends BaseController {
  constructor(private useCase: ListTasksUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const validation = await listTasksSchema.safeParseAsync(req.query);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const payload = validation.data;

    const result = await this.useCase.execute({
      educatorId: user.id,
      id: payload.id ? new Uuid(payload.id) : undefined,
      category: payload.category,
      type: payload.type,
      promptContains: payload.promptContains,
    });

    if (!result.ok) {
      return this.fail(res, result.error);
    }

    return this.ok(res, result.value);
  }
}
