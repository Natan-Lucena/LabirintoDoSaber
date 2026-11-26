import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { CreateTaskNotebookUseCase } from "./create-task-notebook-use-case";
import { Request, Response } from "express";
import { CreateTaskNotebookSchema } from "../../schemas/create-task-notebook-schema";

export class CreateTaskNotebookController extends BaseController {
  constructor(private useCase: CreateTaskNotebookUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user!;
    const validation = await CreateTaskNotebookSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }
    const payload = validation.data;
    const result = await this.useCase.execute({
      ...payload,
      educatorEmail: user.email,
    });

    if (!result.ok) {
      if (result.error === "PRINTABLE_NOT_PLAYABLE") {
        return this.clientError(res, result.error);
      }
      if (
        result.error === "EDUCATOR_DOES_NOT_EXISTS" ||
        result.error === "TASKS_DOES_NOT_EXISTS"
      ) {
        return this.notFound(res, result.error);
      } else {
        return this.fail(res, result.error);
      }
    }

    return this.ok(res, result.value);
  }
}
