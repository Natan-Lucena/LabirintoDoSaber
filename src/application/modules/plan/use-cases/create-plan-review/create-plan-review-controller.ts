import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapPlanReviewToResponse } from "../../../../../infraestructure/mappers/map-plan";
import { createPlanReviewSchema } from "../../schemas/create-plan-review.schema";
import { CreatePlanReviewUseCase } from "./create-plan-review-use-case";

export class CreatePlanReviewController extends BaseController {
  constructor(private useCase: CreatePlanReviewUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await createPlanReviewSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: educator.id,
      planId: req.params.id,
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

    return this.created(res, mapPlanReviewToResponse(result.value));
  }
}
