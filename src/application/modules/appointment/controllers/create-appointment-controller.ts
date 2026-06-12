import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { CreateAppointmentUseCase } from "../use-cases/create-appointment/create-appointment-use-case";

export class CreateAppointmentController extends BaseController {
  constructor(private useCase: CreateAppointmentUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const { studentId, scheduledAt, observation } = req.body;

    if (!studentId || !scheduledAt) {
      return this.clientError(res, "studentId and scheduledAt are required");
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      studentId,
      scheduledAt: new Date(scheduledAt),
      observation,
    });

    return this.created(res, result.value);
  }
}
