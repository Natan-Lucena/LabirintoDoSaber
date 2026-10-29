import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapPlanToResponse } from "../../../../../infraestructure/mappers/map-plan";
import { changeGoalStatusSchema } from "../../schemas/change-goal-status.schema";
import { ChangeGoalStatusUseCase } from "./change-goal-status-use-case";

export class ChangeGoalStatusController extends BaseController {
  constructor(private useCase: ChangeGoalStatusUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await changeGoalStatusSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      planId: req.params.id,
      goalId: req.params.goalId,
      status: validation.data.status,
    });

    if (!result.ok) {
      switch (result.error) {
        case "PLAN_NOT_FOUND":
        case "GOAL_NOT_FOUND":
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
