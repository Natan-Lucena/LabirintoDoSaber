import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapSessionEvolutionToResponse } from "../../../../../infraestructure/mappers/map-session-evolution";
import { createSessionEvolutionSchema } from "../../schemas/create-session-evolution.schema";
import { CreateSessionEvolutionUseCase } from "./create-session-evolution-use-case";

export class CreateSessionEvolutionController extends BaseController {
  constructor(private useCase: CreateSessionEvolutionUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await createSessionEvolutionSchema.safeParseAsync(req.body);
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
          evolutionId: result.error.evolutionId,
        });
      }

      switch (result.error) {
        case "SESSION_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "SESSION_NOT_FINISHED":
        case "PLAN_NOT_EDITABLE":
          return this.conflict(res, result.error);
        default:
          return this.clientError(res, result.error);
      }
    }

    return this.created(res, mapSessionEvolutionToResponse(result.value));
  }
}
