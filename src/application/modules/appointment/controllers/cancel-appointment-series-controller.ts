import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapSeriesResultToResponse } from "../../../../infraestructure/mappers/map-appointment-series";
import { cancelAppointmentSeriesSchema } from "../schemas/appointment-schemas";
import { CancelAppointmentSeriesUseCase } from "../use-cases/cancel-appointment-series/cancel-appointment-series-use-case";

export class CancelAppointmentSeriesController extends BaseController {
  constructor(private useCase: CancelAppointmentSeriesUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const validation = await cancelAppointmentSeriesSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      seriesId: String(req.params.id),
      fromAppointmentId: validation.data.fromAppointmentId,
    });

    if (!result.ok) {
      switch (result.error) {
        case "SERIES_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "APPOINTMENT_NOT_IN_SERIES":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, mapSeriesResultToResponse(result.value));
  }
}
