import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GenerateStudentAiAnalysisUseCase } from "./generate-student-ai-analysis-use-case";
import { generateStudentAnalisysSchema } from "../../schemas/generate-student-analisys.schema";
import { generateStudentAiAnalysisQuerySchema } from "../../schemas/generate-student-ai-analysis.schema";

export class GenerateStudentAiAnalysisController extends BaseController {
  constructor(private useCase: GenerateStudentAiAnalysisUseCase) {
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

    const queryValidation =
      await generateStudentAiAnalysisQuerySchema.safeParseAsync(req.query);

    if (!queryValidation.success) {
      const errors = formatValidationErrors(queryValidation.error);
      return this.clientError(res, undefined, errors);
    }

    const { studentId } = paramsValidation.data;
    const { startDate, endDate, limit, templateId } = queryValidation.data;

    const result = await this.useCase.execute({
      studentId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      templateId,
    });

    if (!result.ok) {
      if (result.error === "STUDENT_NOT_FOUND") {
        return this.notFound(res, "STUDENT_NOT_FOUND");
      }
      return this.fail(res, result.error);
    }

    return this.ok(res, result.value);
  }
}
