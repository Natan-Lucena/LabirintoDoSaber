import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { AddStudentDocumentUseCase } from "./add-student-document-use-case";

export class AddStudentDocumentController extends BaseController {
  constructor(private useCase: AddStudentDocumentUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const file = req.file;
    if (!file) {
      return this.clientError(res, "FILE_REQUIRED");
    }

    const result = await this.useCase.execute({
      studentId: req.params.id,
      educatorEmail: educator.email,
      file,
    });

    if (!result.ok) {
      if (result.error === "STUDENT_NOT_FOUND") {
        return this.notFound(res, result.error);
      }
      if (result.error === "EDUCATOR_NOT_FOUND") {
        return this.notFound(res, result.error);
      }
      if (result.error === "STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR") {
        return this.clientError(res, result.error);
      }
      return this.fail(res, result.error);
    }

    return this.ok(res, result.value);
  }
}
