import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { ListStudentAnalysisHistoryUseCase } from "./list-student-analysis-history-use-case";
import { Request, Response } from "express";
import { generateStudentAnalisysSchema } from "../../schemas/generate-student-analisys.schema";

export class ListStudentAnalysisHistoryController extends BaseController {
  constructor(private useCase: ListStudentAnalysisHistoryUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const paramsValidation = await generateStudentAnalisysSchema.safeParseAsync(
      req.params
    );

    if (!paramsValidation.success) {
      const errors = formatValidationErrors(paramsValidation.error);
      return this.clientError(res, undefined, errors);
    }

    const { studentId } = paramsValidation.data;
    const result = await this.useCase.execute({
      studentId,
      educatorId: educator.id,
    });

    if (!result.ok) {
      if (result.error === "STUDENT_NOT_FOUND") {
        return this.notFound(res, "STUDENT_NOT_FOUND");
      }
      if (result.error === "UNAUTHORIZED") {
        return this.forbidden(res, "UNAUTHORIZED");
      }
      return this.fail(res, result.error);
    }

    return this.ok(res, result.value);
  }
}
