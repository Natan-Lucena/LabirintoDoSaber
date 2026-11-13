import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { listNotificationsSchema } from "../../schemas/list-notifications.schema";
import { ListNotificationsUseCase } from "./list-notifications-use-case";

export class ListNotificationsController extends BaseController {
  constructor(private useCase: ListNotificationsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await listNotificationsSchema.safeParseAsync(req.query);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      ...validation.data,
    });

    if (!result.ok) {
      switch (result.error) {
        case "INVALID_CURSOR":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
