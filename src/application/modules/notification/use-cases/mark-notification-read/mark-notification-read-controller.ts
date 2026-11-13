import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { MarkNotificationReadUseCase } from "./mark-notification-read-use-case";

export class MarkNotificationReadController extends BaseController {
  constructor(private useCase: MarkNotificationReadUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: educator.id,
      notificationId: req.params.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "NOTIFICATION_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
