import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { UnreadCountUseCase } from "./unread-count-use-case";

export class UnreadCountController extends BaseController {
  constructor(private useCase: UnreadCountUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({ educatorId: educator.id });

    return this.ok(res, result.value);
  }
}
