import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GetStudentUseCase } from "./get-student-use-case";

export class GetStudentController extends BaseController {
  constructor(private useCase: GetStudentUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: educator.id,
      studentId: String(req.params.id),
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
