import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapPlanToResponse } from "../../../../../infraestructure/mappers/map-plan";
import { AcceptPlanSuggestionUseCase } from "./accept-plan-suggestion-use-case";

export class AcceptPlanSuggestionController extends BaseController {
  constructor(private useCase: AcceptPlanSuggestionUseCase) {
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
        case "PLAN_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "SUGGESTION_ALREADY_RESOLVED":
        case "SUGGESTION_NOT_APPLICABLE":
          return this.conflict(res, result.error);
        default:
          return this.clientError(res, result.error);
      }
    }

    return this.ok(res, mapPlanToResponse(result.value));
  }
}
