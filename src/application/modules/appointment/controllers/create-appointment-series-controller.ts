import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { RecurrenceFrequency } from "../../../../domain/entities/appointment-series";
import { mapSeriesResultToResponse } from "../../../../infraestructure/mappers/map-appointment-series";
import { createAppointmentSeriesSchema } from "../schemas/appointment-schemas";
import { CreateAppointmentSeriesUseCase } from "../use-cases/create-appointment-series/create-appointment-series-use-case";

export class CreateAppointmentSeriesController extends BaseController {
  constructor(private useCase: CreateAppointmentSeriesUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const validation = await createAppointmentSeriesSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const { studentId, scheduledAt, frequency, occurrences, type, durationMinutes, observation } =
      validation.data;

    const result = await this.useCase.execute({
      educatorId: educator.id,
      studentId,
      scheduledAt: new Date(scheduledAt),
      frequency: RecurrenceFrequency[frequency],
      occurrences,
      type,
      durationMinutes,
      observation,
    });

    if (!result.ok) {
      if (typeof result.error === "object") {
        return res.status(409).json({
          message: result.error.code,
          conflictingAppointmentId: result.error.conflictingAppointmentId,
        });
      }

      switch (result.error) {
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "STUDENT_ARCHIVED":
          return this.conflict(res, result.error);
        case "INVALID_OCCURRENCES":
        case "SERIES_TOO_LONG":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.created(res, mapSeriesResultToResponse(result.value));
  }
}
