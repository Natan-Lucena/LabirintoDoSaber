import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { DeleteAnamneseTemplateUseCase } from "./delete-anamnese-template-use-case";

export class DeleteAnamneseTemplateController extends BaseController {
  constructor(private useCase: DeleteAnamneseTemplateUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const result = await this.useCase.execute({
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
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, null);
  }
}
