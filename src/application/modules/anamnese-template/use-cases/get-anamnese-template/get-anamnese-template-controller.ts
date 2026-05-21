import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GetAnamneseTemplateUseCase } from "./get-anamnese-template-use-case";

export class GetAnamneseTemplateController extends BaseController {
  constructor(private useCase: GetAnamneseTemplateUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const { templateId } = req.params;

    const result = await this.useCase.execute({
      templateId,
      educatorId: user.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "TEMPLATE_NOT_FOUND":
          return this.notFound(res, "TEMPLATE_NOT_FOUND");
        case "UNAUTHORIZED":
          return this.unauthorized(res);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
