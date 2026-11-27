import { BaseController, formatValidationErrors } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { studentStatusQuerySchema } from "../../schemas/student-status-schema";
import { GetStudentsOverviewUseCase } from "./get-students-overview-use-case";

export class GetStudentsOverviewController extends BaseController {
  constructor(private useCase: GetStudentsOverviewUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await studentStatusQuerySchema.safeParseAsync(req.query);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const overview = await this.useCase.execute({
      educatorId: educator.id,
      status: validation.data.status,
    });
    return this.ok(res, overview);
  }
}
