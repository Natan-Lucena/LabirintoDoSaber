import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { createAppointmentSchema } from "../schemas/appointment-schemas";
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

    const validation = await createAppointmentSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const { studentId, scheduledAt, observation } = validation.data;

    const result = await this.useCase.execute({
      educatorId: educator.id,
      studentId,
      scheduledAt: new Date(scheduledAt),
      observation,
    });

    return this.created(res, result.value);
  }
}
