import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { UpdateAnamneseTemplateUseCase } from "./update-anamnese-template-use-case";
import { updateAnamneseTemplateSchema } from "../../schemas/update-anamnese-template.schema";

export class UpdateAnamneseTemplateController extends BaseController {
  constructor(private useCase: UpdateAnamneseTemplateUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const validation = await updateAnamneseTemplateSchema.safeParseAsync(req.body);
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
        case "UNAUTHORIZED":
          return this.unauthorized(res);
        case "TEMPLATE_HAS_RESPONSES":
          return this.clientError(res, "TEMPLATE_HAS_RESPONSES");
        case "INVALID_TEMPLATE_DATA":
          return this.clientError(res, "INVALID_TEMPLATE_DATA");
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
