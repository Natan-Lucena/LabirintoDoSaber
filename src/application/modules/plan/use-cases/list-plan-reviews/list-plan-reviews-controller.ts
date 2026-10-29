import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapPlanReviewToResponse } from "../../../../../infraestructure/mappers/map-plan";
import { ListPlanReviewsUseCase } from "./list-plan-reviews-use-case";

export class ListPlanReviewsController extends BaseController {
  constructor(private useCase: ListPlanReviewsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: educator.id,
      planId: req.params.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "PLAN_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value.map(mapPlanReviewToResponse));
  }
}
