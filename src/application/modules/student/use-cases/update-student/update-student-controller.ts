import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { UpdateStudentUseCase } from "./update-student-use-case";
import { Request, Response } from "express";
import { updateStudentSchema } from "../../schemas/update-student-schema";
import { Uuid } from "@wave-telecom/framework/core";

export class UpdateStudentController extends BaseController {
  constructor(private useCase: UpdateStudentUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    if (typeof req.body.age === "string") {
      req.body.age = Number(req.body.age);
    }

    const validation = await updateStudentSchema.safeParseAsync({
      ...req.body,
      ...req.params,
    });
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }
    const photo = req.file;

    const payload = validation.data;
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }
    const result = await this.useCase.execute({
      educatorEmail: educator.email,
      ...payload,
      photo,
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
