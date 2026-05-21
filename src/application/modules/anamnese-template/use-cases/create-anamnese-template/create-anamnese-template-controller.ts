import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { CreateAnamneseTemplateUseCase } from "./create-anamnese-template-use-case";
import { createAnamneseTemplateSchema } from "../../schemas/create-anamnese-template.schema";

export class CreateAnamneseTemplateController extends BaseController {
  constructor(private useCase: CreateAnamneseTemplateUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const validation = await createAnamneseTemplateSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: user.id,
    });

    if (!result.ok) {
      return this.fail(res, "TEMPLATE_CREATION_FAILED");
    }

    return this.ok(res, result.value);
  }
}
