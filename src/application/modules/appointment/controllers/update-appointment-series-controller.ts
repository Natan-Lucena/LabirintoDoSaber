import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapSeriesResultToResponse } from "../../../../infraestructure/mappers/map-appointment-series";
import { updateAppointmentSeriesSchema } from "../schemas/appointment-schemas";
import { UpdateAppointmentSeriesUseCase } from "../use-cases/update-appointment-series/update-appointment-series-use-case";

export class UpdateAppointmentSeriesController extends BaseController {
  constructor(private useCase: UpdateAppointmentSeriesUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const validation = await updateAppointmentSeriesSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const { fromAppointmentId, scheduledAt, durationMinutes, type, observation } = validation.data;

    const result = await this.useCase.execute({
      educatorId: educator.id,
      seriesId: String(req.params.id),
      fromAppointmentId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      durationMinutes,
      type,
      observation,
    });

    if (!result.ok) {
      switch (result.error) {
        case "SERIES_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "APPOINTMENT_NOT_IN_SERIES":
          return this.clientError(res, result.error);
        case "APPOINTMENT_NOT_EDITABLE":
          return this.conflict(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, mapSeriesResultToResponse(result.value));
  }
}
