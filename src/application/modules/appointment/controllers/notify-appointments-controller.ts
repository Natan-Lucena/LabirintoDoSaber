import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { NotifyAppointmentsUseCase } from "../use-cases/notify-appointments/notify-appointments-use-case";

export class NotifyAppointmentsController extends BaseController {
  constructor(private useCase: NotifyAppointmentsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    await this.useCase.execute();
    return this.ok(res, { message: "Notifications sent" });
  }
}
