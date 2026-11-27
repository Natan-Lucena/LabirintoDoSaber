import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { GeneratorReportTaskNotebookSessionUseCase } from "./generator-report-task-notebook-session-use-case";
import { Request, Response } from "express";
import { GeneratorReportTaskNotebookSessionSchema } from "../../schemas/generator-report-task-notebook-session-schema";

export class GeneratorReportTaskNotebookSessionController extends BaseController {
  constructor(
    private useCase: GeneratorReportTaskNotebookSessionUseCase) {
    super();
  }
    async executeImpl(req: Request, res: Response): Promise<Response> {
        const educator = req.user;
        if (!educator) return this.unauthorized(res);

        const validation = await GeneratorReportTaskNotebookSessionSchema.safeParseAsync(
            req.params  
        );

        if (!validation.success) {
            const errors = formatValidationErrors(validation.error);
            return this.clientError(res, undefined, errors);
        }

        const result = await this.useCase.execute({
            ...validation.data,
            educatorId: educator.id,
        });

        if (!result.ok) {
            switch (result.error) {
                case "SESSION_NOT_FOUND":
                case "STUDENT_NOT_FOUND":
                    return this.notFound(res, result.error);
                case "UNAUTHORIZED":
                    return this.forbidden(res, "UNAUTHORIZED");
                default:
                    return this.fail(res, "INTERNAL_SERVER_ERROR");
            }
        }

        return this.ok(res, result.value);
    }

}
