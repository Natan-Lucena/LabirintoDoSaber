import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { UpdatePasswordEducatorUseCase } from "./update-password-educator-use-case";
import { updatePasswordEducatorSchema } from "../../schemas/update-password-educator-schema";

export class UpdatePasswordEducatorController extends BaseController {
  constructor(private useCase: UpdatePasswordEducatorUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const validation = await updatePasswordEducatorSchema.safeParseAsync(
      req.body
    );

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute(validation.data);

    if (!result.ok) {
      switch (result.error) {
        case "INVALID_TOKEN":
        case "EXPIRED_TOKEN":
        case "PASSWORD_SAME_AS_OLD":
          return this.clientError(res, result.error);
        case "TOO_MANY_ATTEMPTS":
          return res.status(429).json({ message: result.error });
        default:
          return this.fail(res, "INTERNAL_ERROR");
      }
    }

    return this.ok(res);
  }
}
