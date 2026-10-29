import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { UpdateAnamneseResponseUseCase } from "./update-anamnese-response-use-case";
import { updateAnamneseResponseSchema } from "../../schemas/update-anamnese-response.schema";

export class UpdateAnamneseResponseController extends BaseController {
  constructor(private useCase: UpdateAnamneseResponseUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const validation = await updateAnamneseResponseSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      responseId: String(req.params.responseId),
      educatorId: user.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "RESPONSE_NOT_FOUND":
          return this.notFound(res, "RESPONSE_NOT_FOUND");
        case "TEMPLATE_NOT_FOUND":
          return this.notFound(res, "TEMPLATE_NOT_FOUND");
        case "UNAUTHORIZED":
          return this.forbidden(res, "UNAUTHORIZED");
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
