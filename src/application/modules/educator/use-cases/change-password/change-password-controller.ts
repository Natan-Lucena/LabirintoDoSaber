import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { ChangePasswordUseCase } from "./change-password-use-case";
import { changePasswordSchema } from "../../schemas/change-password-schema";

export class ChangePasswordController extends BaseController {
  constructor(private useCase: ChangePasswordUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const validation = await changePasswordSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educator,
      ...validation.data,
    });

    if (!result.ok) {
      switch (result.error) {
        case "INVALID_CURRENT_PASSWORD":
        case "PASSWORD_SAME_AS_OLD":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
