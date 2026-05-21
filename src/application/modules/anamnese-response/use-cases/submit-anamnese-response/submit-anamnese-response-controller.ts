import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { SubmitAnamneseResponseUseCase } from "./submit-anamnese-response-use-case";
import { submitAnamneseResponseSchema } from "../../schemas/submit-anamnese-response.schema";

export class SubmitAnamneseResponseController extends BaseController {
  constructor(private useCase: SubmitAnamneseResponseUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const validation = await submitAnamneseResponseSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      templateId: req.params.templateId,
      educatorId: user.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "TEMPLATE_NOT_FOUND":
          return this.notFound(res, "TEMPLATE_NOT_FOUND");
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, "STUDENT_NOT_FOUND");
        case "MISSING_REQUIRED_ANSWER":
        case "MISSING_TEXT_VALUE":
        case "MISSING_SELECTED_OPTION":
        case "MISSING_SELECTED_OPTIONS":
        case "MISSING_FILE_URL":
        case "INVALID_QUESTION_ID":
        case "INVALID_OPTION_ID":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
