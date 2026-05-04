import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { AddObservationTaskNotebookSessionUseCase } from "./add-observation-task-notebook-session-use-case";
import { Request, Response } from "express";
import { addObservationTaskNotebookSessionSchema } from "../../schemas/add-observation-task-notebook-session.schema";

export class AddObservationTaskNotebookSessionController extends BaseController {
  constructor(private useCase: AddObservationTaskNotebookSessionUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const validation = await addObservationTaskNotebookSessionSchema.safeParseAsync(
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
        case "SESSION_NOT_FINISHED":
          return this.clientError(res, "SESSION_NOT_FINISHED");
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
