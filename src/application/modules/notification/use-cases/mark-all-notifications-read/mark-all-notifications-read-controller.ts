import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { MarkAllNotificationsReadUseCase } from "./mark-all-notifications-read-use-case";

export class MarkAllNotificationsReadController extends BaseController {
  constructor(private useCase: MarkAllNotificationsReadUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({ educatorId: educator.id });

    return this.ok(res, result.value);
  }
}
