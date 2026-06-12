import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { Uuid } from "@wave-telecom/framework/core";
import { UpdateAppointmentUseCase } from "../use-cases/update-appointment/update-appointment-use-case";

export class UpdateAppointmentController extends BaseController {
  constructor(private useCase: UpdateAppointmentUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const { id } = req.params;
    const { scheduledAt, observation } = req.body;

    const result = await this.useCase.execute({
      id: new Uuid(id),
      educatorId: educator.id,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      observation,
    });

    if (!result.ok) {
      if (result.error === "NOT_FOUND") {
        return this.clientError(res, "NOT_FOUND");
      }
      return this.fail(res, result.error);
    }

    return this.ok(res, result.value);
  }
}
