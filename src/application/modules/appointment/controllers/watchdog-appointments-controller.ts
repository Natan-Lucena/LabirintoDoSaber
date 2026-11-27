import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { WatchdogAppointmentsUseCase } from "../use-cases/watchdog-appointments/watchdog-appointments-use-case";
import { CheckPushReceiptsUseCase } from "../../notification/use-cases/check-push-receipts/check-push-receipts-use-case";

// Cron diário das 05:00 UTC. Depois do watchdog dos lembretes, confere os
// recibos do push do dia anterior (~20 h depois, dentro da janela de 24 h da
// Expo). CheckPushReceiptsUseCase não lança: a falha dele fica isolada.
export class WatchdogAppointmentsController extends BaseController {
  constructor(
    private useCase: WatchdogAppointmentsUseCase,
    private checkPushReceiptsUseCase: CheckPushReceiptsUseCase
  ) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    await this.useCase.execute();
    await this.checkPushReceiptsUseCase.execute();
    return this.ok(res, { message: "Watchdog executed" });
  }
}
