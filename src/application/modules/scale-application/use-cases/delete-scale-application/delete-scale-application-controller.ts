import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { DeleteScaleApplicationUseCase } from "./delete-scale-application-use-case";

export class DeleteScaleApplicationController extends BaseController {
  constructor(private useCase: DeleteScaleApplicationUseCase) {
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
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "APPLICATION_NOT_EDITABLE":
          return this.conflict(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.noContent(res);
  }
}
