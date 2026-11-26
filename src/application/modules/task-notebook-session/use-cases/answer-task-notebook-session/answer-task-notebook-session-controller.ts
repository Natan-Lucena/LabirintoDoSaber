import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { AnswerTaskNotebookSessionUseCase } from "./answer-task-notebook-session-use-case";
import { Request, Response } from "express";
import { answerTaskNotebookSessionSchema } from "../../schemas/answer-task-notebook-session.schema";

export class AnswerTaskNotebookSessionController extends BaseController {
  constructor(private useCase: AnswerTaskNotebookSessionUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const validation = await answerTaskNotebookSessionSchema.safeParseAsync(
      req.body
    );

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute(validation.data);

    if (!result.ok) {
      switch (result.error) {
        case "SESSION_NOT_FOUND":
          return this.notFound(res, "SESSION_NOT_FOUND");
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
        case "TASK_ALREADY_ANSWERED":
          return this.clientError(res, "TASK_ALREADY_ANSWERED");
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }
    return this.ok(res, result.value);
  }
}
