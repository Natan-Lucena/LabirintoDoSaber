import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { Uuid } from "@wave-telecom/framework/core";
import { GetAppointmentUseCase } from "../use-cases/get-appointment/get-appointment-use-case";

export class GetAppointmentController extends BaseController {
  constructor(private useCase: GetAppointmentUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const { id } = req.params;

    const result = await this.useCase.execute({
      id: new Uuid(id),
      educatorId: educator.id,
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
