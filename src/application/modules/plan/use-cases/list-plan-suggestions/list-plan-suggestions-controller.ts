import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { listPlanSuggestionsSchema } from "../../schemas/list-plan-suggestions.schema";
import { ListPlanSuggestionsUseCase } from "./list-plan-suggestions-use-case";

export class ListPlanSuggestionsController extends BaseController {
  constructor(private useCase: ListPlanSuggestionsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await listPlanSuggestionsSchema.safeParseAsync(req.query);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: educator.id,
    });

    return this.ok(res, result.value);
  }
}
