import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapScaleApplicationToResponse } from "../../../../../infraestructure/mappers/map-scale";
import { GetScaleApplicationUseCase } from "./get-scale-application-use-case";

export class GetScaleApplicationController extends BaseController {
  constructor(private useCase: GetScaleApplicationUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: educator.id,
      applicationId: req.params.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "APPLICATION_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
        case "SCALE_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    const { application, template, studentName } = result.value;
    return this.ok(res, mapScaleApplicationToResponse(application, template, studentName));
  }
}
