import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { Uuid } from "@wave-telecom/framework/core";
import { AppointmentStatus } from "../../../../domain/entities/appointment";
import { mapAppointmentToResponse } from "../../../../infraestructure/mappers/map-appointment";
import { updateAppointmentSchema } from "../schemas/appointment-schemas";
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

    const validation = await updateAppointmentSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const { id } = req.params;
    const { scheduledAt, observation, type, durationMinutes, status } = validation.data;

    const result = await this.useCase.execute({
      id: new Uuid(id),
      educatorId: educator.id,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      observation,
      type,
      durationMinutes,
      status: status ? AppointmentStatus[status] : undefined,
    });

    if (!result.ok) {
      if (typeof result.error === "object") {
        return res.status(409).json({
          message: result.error.code,
          conflictingAppointmentId: result.error.conflictingAppointmentId,
        });
      }

      switch (result.error) {
        case "NOT_FOUND":
          return this.clientError(res, result.error);
        case "INVALID_STATUS_TRANSITION":
        case "APPOINTMENT_NOT_EDITABLE":
          return this.conflict(res, result.error);
        default:
          return this.fail(res, result.error);
      }
    }

    return this.ok(res, mapAppointmentToResponse(result.value));
  }
}
