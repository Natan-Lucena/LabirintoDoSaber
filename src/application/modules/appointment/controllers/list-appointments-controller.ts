import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { ListAppointmentsUseCase } from "../use-cases/list-appointments/list-appointments-use-case";

export class ListAppointmentsController extends BaseController {
  constructor(private useCase: ListAppointmentsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const appointments = await this.useCase.execute({ educatorId: educator.id });
    return this.ok(res, appointments);
  }
}
