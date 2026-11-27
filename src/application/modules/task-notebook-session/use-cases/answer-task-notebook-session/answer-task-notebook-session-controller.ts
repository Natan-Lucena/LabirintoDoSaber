import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { AnswerTaskNotebookSessionUseCase } from "./answer-task-notebook-session-use-case";
import { Request, Response } from "express";
import { mapTaskNotebookSessionToResponse } from "../../../../../infraestructure/mappers/map-task-notebook-session";
import { answerTaskNotebookSessionSchema } from "../../schemas/answer-task-notebook-session.schema";

export class AnswerTaskNotebookSessionController extends BaseController {
  constructor(private useCase: AnswerTaskNotebookSessionUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await answerTaskNotebookSessionSchema.safeParseAsync(
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
        case "SESSION_ALREADY_FINISHED":
          return this.clientError(res, "SESSION_ALREADY_FINISHED");
        case "TASK_NOT_FOUND":
          return this.notFound(res, "TASK_NOT_FOUND");
        case "NOTEBOOK_NOT_FOUND":
          return this.notFound(res, "NOTEBOOK_NOT_FOUND");
        case "TASK_NOT_IN_NOTEBOOK":
          return this.clientError(res, "TASK_NOT_IN_NOTEBOOK");
        case "PRINTABLE_NOT_PLAYABLE":
          return this.clientError(res, "PRINTABLE_NOT_PLAYABLE");
        case "UNAUTHORIZED":
          return this.forbidden(res, "UNAUTHORIZED");
        case "USE_ACTIVITY_RESULT_ROUTE":
          return this.clientError(res, "USE_ACTIVITY_RESULT_ROUTE");
        case "TASK_ALREADY_ANSWERED":
          return this.clientError(res, "TASK_ALREADY_ANSWERED");
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }
    return this.ok(res, mapTaskNotebookSessionToResponse(result.value));
  }
}
