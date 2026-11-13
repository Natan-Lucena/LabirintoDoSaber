import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapScaleTemplateToSummary } from "../../../../../infraestructure/mappers/map-scale";
import { ListScaleTemplatesUseCase } from "./list-scale-templates-use-case";

export class ListScaleTemplatesController extends BaseController {
  constructor(private useCase: ListScaleTemplatesUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    if (!req.user) return this.unauthorized(res);

    const result = await this.useCase.execute();

    return this.ok(res, result.value.map(mapScaleTemplateToSummary));
  }
}
