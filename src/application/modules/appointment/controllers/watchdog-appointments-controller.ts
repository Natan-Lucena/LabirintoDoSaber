import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { WatchdogAppointmentsUseCase } from "../use-cases/watchdog-appointments/watchdog-appointments-use-case";

export class WatchdogAppointmentsController extends BaseController {
  constructor(private useCase: WatchdogAppointmentsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    await this.useCase.execute();
    return this.ok(res, { message: "Watchdog executed" });
  }
}
