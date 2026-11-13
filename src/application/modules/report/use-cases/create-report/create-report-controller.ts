import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapReportToResponse } from "../../../../../infraestructure/mappers/map-report";
import { createReportSchema } from "../../schemas/create-report.schema";
import { CreateReportUseCase } from "./create-report-use-case";

export class CreateReportController extends BaseController {
  constructor(private useCase: CreateReportUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await createReportSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: educator.id,
      professional: { name: educator.name, profession: educator.profession },
    });

    if (!result.ok) {
      switch (result.error) {
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "INVALID_PERIOD":
        case "NO_SECTIONS":
        case "SECTION_NOT_ALLOWED":
        case "REPORT_EMPTY_PERIOD":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.created(res, mapReportToResponse(result.value));
  }
}
