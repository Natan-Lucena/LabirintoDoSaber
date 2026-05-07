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
    const paramsValidation = await generateStudentAnalisysSchema.safeParseAsync(
      req.params
    );

    if (!paramsValidation.success) {
      const errors = formatValidationErrors(paramsValidation.error);
      return this.clientError(res, undefined, errors);
    }

    const { studentId } = paramsValidation.data;
    const reports = await this.useCase.execute({ studentId });

    return this.ok(res, reports);
  }
}
