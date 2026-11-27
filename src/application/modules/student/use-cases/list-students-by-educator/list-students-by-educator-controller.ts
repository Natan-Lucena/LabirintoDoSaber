import { BaseController, formatValidationErrors } from "@wave-telecom/framework/controllers";
import { ListStudentsByEducatorUseCase } from "./list-students-by-educator-use-case";
import { Request, Response } from "express";
import { studentStatusQuerySchema } from "../../schemas/student-status-schema";

export class ListStudentsByEducatorController extends BaseController {
  constructor(private useCase: ListStudentsByEducatorUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res, "UNHAUTHORIZED");
    }

    const validation = await studentStatusQuerySchema.safeParseAsync(req.query);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const students = await this.useCase.execute({
      educatorId: educator.id,
      status: validation.data.status,
    });
    return this.ok(res, students);
  }
}
