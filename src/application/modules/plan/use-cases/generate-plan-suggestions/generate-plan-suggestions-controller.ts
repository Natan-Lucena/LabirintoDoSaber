import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GeneratePlanSuggestionsUseCase } from "./generate-plan-suggestions-use-case";

export class GeneratePlanSuggestionsController extends BaseController {
  constructor(private useCase: GeneratePlanSuggestionsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: educator.id,
      planId: req.params.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "PLAN_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "PLAN_NOT_EDITABLE":
          return this.conflict(res, result.error);
        case "AI_GENERATION_FAILED":
        case "AI_INVALID_OUTPUT":
          return this.fail(res, result.error);
        default:
          return this.clientError(res, result.error);
      }
    }

    // Nada gerado (limite de pendentes já atingido ou tudo descartado): 200 [].
    if (result.value.length === 0) return this.ok(res, result.value);

    return this.created(res, result.value);
  }
}
