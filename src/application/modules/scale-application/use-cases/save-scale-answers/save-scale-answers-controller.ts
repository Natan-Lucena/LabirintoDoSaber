import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapScaleApplicationToResponse } from "../../../../../infraestructure/mappers/map-scale";
import { saveScaleAnswersSchema } from "../../schemas/save-scale-answers.schema";
import { SaveScaleAnswersUseCase } from "./save-scale-answers-use-case";

export class SaveScaleAnswersController extends BaseController {
  constructor(private useCase: SaveScaleAnswersUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await saveScaleAnswersSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      applicationId: req.params.id,
      answers: validation.data.answers,
    });

    if (!result.ok) {
      switch (result.error) {
        case "APPLICATION_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
        case "SCALE_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "APPLICATION_NOT_EDITABLE":
          return this.conflict(res, result.error);
        default:
          return this.clientError(res, result.error);
      }
    }

    const { application, template, studentName } = result.value;
    return this.ok(res, mapScaleApplicationToResponse(application, template, studentName));
  }
}
