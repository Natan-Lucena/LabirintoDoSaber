import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { Uuid } from "@wave-telecom/framework/core";
import { listAppointmentsQuerySchema } from "../schemas/appointment-schemas";
import { ListAppointmentsUseCase } from "../use-cases/list-appointments/list-appointments-use-case";

export class ListAppointmentsController extends BaseController {
  constructor(private useCase: ListAppointmentsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }

    const validation = await listAppointmentsQuerySchema.safeParseAsync(req.query);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      studentId: validation.data.studentId ? new Uuid(validation.data.studentId) : undefined,
      from: validation.data.from,
      to: validation.data.to,
    });

    if (!result.ok) {
      switch (result.error) {
        case "INVALID_PERIOD":
          return this.clientError(res, result.error);
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
