import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapPlanToResponse } from "../../../../../infraestructure/mappers/map-plan";
import { closePlanSchema } from "../../schemas/close-plan.schema";
import { ClosePlanUseCase } from "./close-plan-use-case";

export class ClosePlanController extends BaseController {
  constructor(private useCase: ClosePlanUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await closePlanSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      planId: req.params.id,
      status: validation.data.status,
    });

    if (!result.ok) {
      switch (result.error) {
        case "PLAN_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "PLAN_NOT_EDITABLE":
          return this.conflict(res, result.error);
        default:
          return this.clientError(res, result.error);
      }
    }

    return this.ok(res, mapPlanToResponse(result.value));
  }
}
