import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GenerateDailyNotificationsUseCase } from "./generate-daily-notifications-use-case";
import { SendDailyPushUseCase } from "../send-daily-push/send-daily-push-use-case";

// Chamado pelo cron da Vercel; o segredo é conferido no requireCronSecret.
// Gera as notificações do dia e depois manda o push diário (PU-02).
export class GenerateDailyNotificationsController extends BaseController {
  constructor(
    private useCase: GenerateDailyNotificationsUseCase,
    private sendDailyPushUseCase: SendDailyPushUseCase
  ) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const result = await this.useCase.execute();
    const push = await this.sendDailyPushUseCase.execute();
    return this.ok(res, { ...result.value, push: push.value });
  }
}
