import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { StartTaskNotebookSessionUseCase } from "./start-task-session-use-case";
import { Request, Response } from "express";
import { startTaskSessionSchema } from "../../schemas/start-task-session.schema";

export class StartTaskNotebookSessionController extends BaseController {
  constructor(private useCase: StartTaskNotebookSessionUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) {
      return this.unauthorized(res);
    }

    const validation = await startTaskSessionSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: user.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, "STUDENT_NOT_FOUND");
        case "NOTEBOOK_NOT_FOUND":
          return this.notFound(res, "NOTEBOOK_NOT_FOUND");
        case "APPOINTMENT_NOT_FOUND":
          return this.notFound(res, "APPOINTMENT_NOT_FOUND");
        case "SESSION_CREATION_FAILED":
          return this.fail(res, "SESSION_CREATION_FAILED");
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }
    return this.ok(res, result.value);
  }
}
