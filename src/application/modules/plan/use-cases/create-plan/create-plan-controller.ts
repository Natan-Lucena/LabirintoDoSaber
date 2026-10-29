import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapPlanToResponse } from "../../../../../infraestructure/mappers/map-plan";
import { createPlanSchema } from "../../schemas/create-plan.schema";
import { CreatePlanUseCase } from "./create-plan-use-case";

export class CreatePlanController extends BaseController {
  constructor(private useCase: CreatePlanUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await createPlanSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: educator.id,
    });

    if (!result.ok) {
      if (typeof result.error === "object") {
        return res.status(409).json({
          message: result.error.code,
          activePlanId: result.error.activePlanId,
        });
      }

      switch (result.error) {
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        default:
          return this.clientError(res, result.error);
      }
    }

    return this.created(res, mapPlanToResponse(result.value));
  }
}
