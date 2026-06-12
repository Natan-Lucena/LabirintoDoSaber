import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { Uuid } from "@wave-telecom/framework/core";
import { DeleteAppointmentUseCase } from "../use-cases/delete-appointment/delete-appointment-use-case";

export class DeleteAppointmentController extends BaseController {
  constructor(private useCase: DeleteAppointmentUseCase) {
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

    return this.ok(res, undefined);
  }
}
