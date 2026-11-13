import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GenerateDailyNotificationsUseCase } from "./generate-daily-notifications-use-case";

// Chamado pelo cron da Vercel; o segredo é conferido no requireCronSecret.
export class GenerateDailyNotificationsController extends BaseController {
  constructor(private useCase: GenerateDailyNotificationsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const result = await this.useCase.execute();
    return this.ok(res, result.value);
  }
}
