import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { listScaleApplicationsSchema } from "../../schemas/list-scale-applications.schema";
import { ListScaleApplicationsUseCase } from "./list-scale-applications-use-case";

export class ListScaleApplicationsController extends BaseController {
  constructor(private useCase: ListScaleApplicationsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await listScaleApplicationsSchema.safeParseAsync(req.query);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: educator.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
