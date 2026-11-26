import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { shareStudentSchema } from "../../schemas/student-share-schema";
import { ShareStudentUseCase } from "./share-student-use-case";

export class ShareStudentController extends BaseController {
  constructor(private useCase: ShareStudentUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await shareStudentSchema.safeParseAsync(req.body);
    if (!validation.success) {
      return this.clientError(res, undefined, formatValidationErrors(validation.error));
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      studentId: String(req.params.id),
      targetEducatorId: validation.data.educatorId,
    });

    if (!result.ok) {
      switch (result.error) {
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "NOT_IN_SAME_CLINIC":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
