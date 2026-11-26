import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { ListTaskNotebookSessionByStudentIdUseCase } from "./list-task-notebook-session-by-student-id-use-case";
import { Request, Response } from "express";
import { listTaskNotebookSessionByStudentId } from "../../schemas/list-task-notebook-session-by-student-id.schema";

export class ListTaskNotebookSessionByStudentIdController extends BaseController {
  constructor(
    private listTaskNotebookSessionByStudentIdUseCase: ListTaskNotebookSessionByStudentIdUseCase
  ) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await listTaskNotebookSessionByStudentId.safeParseAsync(
      req.params
    );

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.listTaskNotebookSessionByStudentIdUseCase.execute({
      ...validation.data,
      educatorId: educator.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, "STUDENT_NOT_FOUND");
        case "UNAUTHORIZED":
          return this.forbidden(res, "UNAUTHORIZED");
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
