import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { listPendingEvolutionsSchema } from "../../schemas/list-pending-evolutions.schema";
import { ListPendingEvolutionsUseCase } from "./list-pending-evolutions-use-case";

export class ListPendingEvolutionsController extends BaseController {
  constructor(private useCase: ListPendingEvolutionsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await listPendingEvolutionsSchema.safeParseAsync(req.query);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      days: validation.data.days,
    });

    return this.ok(res, result.value);
  }
}
