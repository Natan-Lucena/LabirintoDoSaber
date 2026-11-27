import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { updateNotificationPreferencesSchema } from "../../schemas/push-schemas";
import { UpdateNotificationPreferencesUseCase } from "./update-notification-preferences-use-case";

export class UpdateNotificationPreferencesController extends BaseController {
  constructor(private useCase: UpdateNotificationPreferencesUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await updateNotificationPreferencesSchema.safeParseAsync(req.body ?? {});
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      pushEnabled: validation.data.pushEnabled,
      kinds: validation.data.kinds,
    });

    return this.ok(res, result.value);
  }
}
