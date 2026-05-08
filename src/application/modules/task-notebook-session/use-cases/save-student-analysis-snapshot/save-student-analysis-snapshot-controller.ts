import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { SaveStudentAnalysisSnapshotUseCase } from "./save-student-analysis-snapshot-use-case";
import { Request, Response } from "express";
import {
  generateStudentAnalisysSchema,
  generateStudentAnalisysQuerySchema,
} from "../../schemas/generate-student-analisys.schema";

export class SaveStudentAnalysisSnapshotController extends BaseController {
  constructor(private useCase: SaveStudentAnalysisSnapshotUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const paramsValidation = await generateStudentAnalisysSchema.safeParseAsync(
      req.params,
    );

    if (!paramsValidation.success) {
      const errors = formatValidationErrors(paramsValidation.error);
      return this.clientError(res, undefined, errors);
    }

    const queryValidation =
      await generateStudentAnalisysQuerySchema.safeParseAsync(req.query);

    if (!queryValidation.success) {
      const errors = formatValidationErrors(queryValidation.error);
      return this.clientError(res, undefined, errors);
    }

    const { studentId } = paramsValidation.data;
    const { startDate, endDate, limit } = queryValidation.data;

    const result = await this.useCase.execute({
      studentId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
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
