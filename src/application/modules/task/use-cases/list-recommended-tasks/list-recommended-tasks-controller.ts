import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { recommendedSchema } from "../../schemas/catalog-schemas";
import { ListRecommendedTasksUseCase } from "./list-recommended-tasks-use-case";

export class ListRecommendedTasksController extends BaseController {
  constructor(private useCase: ListRecommendedTasksUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const validation = await recommendedSchema.safeParseAsync(req.query);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: user.id,
      studentId: validation.data.studentId,
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
