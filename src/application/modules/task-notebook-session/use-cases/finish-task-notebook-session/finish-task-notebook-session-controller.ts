import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { FinishTaskNotebookSessionUseCase } from "./finish-task-notebook-session-use-case";
import { Request, Response } from "express";
import { finishTaskNotebookSessionSchema } from "../../schemas/finish-task-notebook-session.schema";

export class FinishTaskNotebookController extends BaseController {
  constructor(private useCase: FinishTaskNotebookSessionUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await finishTaskNotebookSessionSchema.safeParseAsync(
      req.body
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
        case "SESSION_ALREADY_FINISHED":
          return this.clientError(res, "SESSION_ALREADY_FINISHED");
        case "SESSION_FINISH_FAILED":
          return this.fail(res, "SESSION_FINISH_FAILED");
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
