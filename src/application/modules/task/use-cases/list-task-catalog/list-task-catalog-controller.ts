import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { catalogSchema } from "../../schemas/catalog-schemas";
import { ListTaskCatalogUseCase } from "./list-task-catalog-use-case";

export class ListTaskCatalogController extends BaseController {
  constructor(private useCase: ListTaskCatalogUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const validation = await catalogSchema.safeParseAsync(req.query);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({ ...validation.data, educatorId: user.id });

    if (!result.ok) return this.clientError(res, result.error);

    return this.ok(res, result.value);
  }
}
