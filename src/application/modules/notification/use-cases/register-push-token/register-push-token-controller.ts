import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { registerPushTokenSchema } from "../../schemas/push-schemas";
import { RegisterPushTokenUseCase } from "./register-push-token-use-case";

export class RegisterPushTokenController extends BaseController {
  constructor(private useCase: RegisterPushTokenUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await registerPushTokenSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      token: validation.data.token,
      platform: validation.data.platform,
    });

    if (!result.ok) {
      switch (result.error) {
        case "INVALID_PUSH_TOKEN":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
