import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapActivityResultToResponse } from "../../../../../infraestructure/mappers/map-activity-result";
import { recordActivityResultSchema } from "../../schemas/record-activity-result.schema";
import { RecordActivityResultUseCase } from "./record-activity-result-use-case";

export class RecordActivityResultController extends BaseController {
  constructor(private useCase: RecordActivityResultUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await recordActivityResultSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: educator.id,
    });

    if (!result.ok) {
      if (typeof result.error === "object") {
        return res.status(409).json({
          message: result.error.code,
          resultId: result.error.resultId,
        });
      }

      switch (result.error) {
        case "SESSION_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
        case "TASK_NOT_FOUND":
        case "NOTEBOOK_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "SESSION_ALREADY_FINISHED":
          return this.conflict(res, result.error);
        case "TASK_NOT_IN_NOTEBOOK":
        case "USE_ANSWER_ROUTE":
        case "PRINTABLE_NOT_PLAYABLE":
        case "INVALID_ACTIVITY_RESULT":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.created(res, mapActivityResultToResponse(result.value));
  }
}
