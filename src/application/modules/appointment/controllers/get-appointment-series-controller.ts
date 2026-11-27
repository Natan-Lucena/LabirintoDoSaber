import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapAppointmentToResponse } from "../../../../infraestructure/mappers/map-appointment";
import { mapAppointmentSeriesToResponse } from "../../../../infraestructure/mappers/map-appointment-series";
import { GetAppointmentSeriesUseCase } from "../use-cases/get-appointment-series/get-appointment-series-use-case";

export class GetAppointmentSeriesController extends BaseController {
  constructor(private useCase: GetAppointmentSeriesUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      seriesId: String(req.params.id),
    });

    if (!result.ok) {
      switch (result.error) {
        case "SERIES_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, {
      ...mapAppointmentSeriesToResponse(result.value.series),
      appointments: result.value.appointments.map(mapAppointmentToResponse),
    });
  }
}
