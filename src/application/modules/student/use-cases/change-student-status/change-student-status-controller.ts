import { BaseController, formatValidationErrors } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { changeStudentStatusSchema } from "../../schemas/student-status-schema";
import { ChangeStudentStatusUseCase } from "./change-student-status-use-case";

export class ChangeStudentStatusController extends BaseController {
  constructor(private useCase: ChangeStudentStatusUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await changeStudentStatusSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: educator.id,
      studentId: String(req.params.id),
    });

    if (!result.ok) {
      if (typeof result.error === "object") {
        return res.status(409).json({
          message: result.error.code,
          count: result.error.count,
        });
      }

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
