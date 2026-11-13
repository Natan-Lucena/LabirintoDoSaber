import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { nextSessionSuggestionSchema } from "../../schemas/next-session-suggestion.schema";
import { NextSessionSuggestionUseCase } from "./next-session-suggestion-use-case";

export class NextSessionSuggestionController extends BaseController {
  constructor(private useCase: NextSessionSuggestionUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await nextSessionSuggestionSchema.safeParseAsync(req.body);
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
        case "SESSION_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "SESSION_NOT_FINISHED":
          return this.conflict(res, result.error);
        case "AI_GENERATION_FAILED":
        case "AI_INVALID_OUTPUT":
          return this.fail(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
