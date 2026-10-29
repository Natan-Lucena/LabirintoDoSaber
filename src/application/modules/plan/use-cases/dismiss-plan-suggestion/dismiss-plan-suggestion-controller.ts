import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { DismissPlanSuggestionUseCase } from "./dismiss-plan-suggestion-use-case";

export class DismissPlanSuggestionController extends BaseController {
  constructor(private useCase: DismissPlanSuggestionUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: educator.id,
      suggestionId: req.params.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "SUGGESTION_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "SUGGESTION_ALREADY_RESOLVED":
          return this.conflict(res, result.error);
        default:
          return this.clientError(res, result.error);
      }
    }

    return this.ok(res, result.value);
  }
}
