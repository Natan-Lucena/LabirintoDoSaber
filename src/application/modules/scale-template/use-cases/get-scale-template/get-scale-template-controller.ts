import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapScaleTemplateToResponse } from "../../../../../infraestructure/mappers/map-scale";
import { GetScaleTemplateUseCase } from "./get-scale-template-use-case";

export class GetScaleTemplateController extends BaseController {
  constructor(private useCase: GetScaleTemplateUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    if (!req.user) return this.unauthorized(res);

    const result = await this.useCase.execute({ templateId: req.params.id });

    if (!result.ok) {
      switch (result.error) {
        case "SCALE_NOT_FOUND":
          return this.notFound(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, mapScaleTemplateToResponse(result.value));
  }
}
