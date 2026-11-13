import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapScaleApplicationToResponse } from "../../../../../infraestructure/mappers/map-scale";
import { startScaleApplicationSchema } from "../../schemas/start-scale-application.schema";
import { StartScaleApplicationUseCase } from "./start-scale-application-use-case";

export class StartScaleApplicationController extends BaseController {
  constructor(private useCase: StartScaleApplicationUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await startScaleApplicationSchema.safeParseAsync(req.body);
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
          applicationId: result.error.applicationId,
        });
      }

      switch (result.error) {
        case "STUDENT_NOT_FOUND":
        case "SCALE_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "SCALE_INACTIVE":
          return this.conflict(res, result.error);
        default:
          return this.clientError(res, result.error);
      }
    }

    const { application, template, studentName } = result.value;
    return this.created(res, mapScaleApplicationToResponse(application, template, studentName));
  }
}
