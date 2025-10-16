import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { SignInEducatorUseCase } from "./sign-in-educator-use-case";
import { Request, Response } from "express";
import { signInEducatorSchema } from "../../schemas/sign-in-educator-schema";

export class SignInEducatorController extends BaseController {
  constructor(private useCase: SignInEducatorUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const validation = await signInEducatorSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const payload = validation.data;
    const result = await this.useCase.execute(payload);

    if (!result.ok) {
      if (result.error == "INVALID_CREDENTIALS") {
        return this.unauthorized(res, "INVALID_CREDENTIALS");
      }
      return this.fail(res, result.error);
    }

    return this.ok(res, { token: result.value });
  }
}
