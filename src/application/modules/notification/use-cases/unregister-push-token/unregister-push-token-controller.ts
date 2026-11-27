import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { unregisterPushTokenSchema } from "../../schemas/push-schemas";
import { UnregisterPushTokenUseCase } from "./unregister-push-token-use-case";

export class UnregisterPushTokenController extends BaseController {
  constructor(private useCase: UnregisterPushTokenUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await unregisterPushTokenSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    await this.useCase.execute({ educatorId: educator.id, token: validation.data.token });

    return this.noContent(res);
  }
}
