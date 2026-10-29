import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { generatePlanDraftSchema } from "../../schemas/generate-plan-draft.schema";
import { GeneratePlanDraftUseCase } from "./generate-plan-draft-use-case";

export class GeneratePlanDraftController extends BaseController {
  constructor(private useCase: GeneratePlanDraftUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await generatePlanDraftSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: educator.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "STUDENT_NOT_FOUND":
        case "PLAN_NOT_FOUND":
        case "TEMPLATE_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "AI_GENERATION_FAILED":
        case "AI_INVALID_OUTPUT":
          return this.fail(res, result.error);
        default:
          return this.clientError(res, result.error);
      }
    }

    return this.ok(res, result.value);
  }
}
