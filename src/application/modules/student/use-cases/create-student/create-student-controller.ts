import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { CreateStudentUseCase } from "./create-student-use-case";
import { Request, Response } from "express";
import { createStudentSchema } from "../../schemas/create-student-schema";

export class CreateStudentController extends BaseController {
  constructor(private useCase: CreateStudentUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const validation = await createStudentSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const payload = validation.data;
    const educator = req.user;

    if (!educator) {
      return this.unauthorized(res);
    }

    const result = await this.useCase.execute({
      educatorEmail: educator.email,
      ...payload,
    });

    if (!result.ok) {
      if (result.error == "EDUCATOR_NOT_FOUND") {
        return this.clientError(res, "EDUCATOR_NOT_FOUND");
      }
      return this.fail(res, result.error);
    }

    return this.created(res);
  }
}
