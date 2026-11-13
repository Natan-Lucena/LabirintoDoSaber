import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapReportToResponse } from "../../../../../infraestructure/mappers/map-report";
import { shareReportSchema } from "../../schemas/share-report.schema";
import { ShareReportUseCase } from "./share-report-use-case";

export class ShareReportController extends BaseController {
  constructor(private useCase: ShareReportUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await shareReportSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      reportId: req.params.id,
      channel: validation.data.channel,
    });

    if (!result.ok) {
      switch (result.error) {
        case "REPORT_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, mapReportToResponse(result.value));
  }
}
