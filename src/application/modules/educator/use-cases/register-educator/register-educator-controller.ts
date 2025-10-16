import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { registerEducatorSchema } from "../../schemas/register-educator-schema";
import { RegisterEducatorUseCase } from "./register-educator-use-case";

export class RegisterEducatorController extends BaseController {
  constructor(private useCase: RegisterEducatorUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const validation = await registerEducatorSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const payload = validation.data;

    const result = await this.useCase.execute(payload);

    if (!result.ok) {
      if (result.error == "EDUCATOR_ALREADY_EXISTS") {
        return this.clientError(res, "EDUCATOR_ALREADY_EXISTS");
      }
    }

    return this.created(res);
  }
}
