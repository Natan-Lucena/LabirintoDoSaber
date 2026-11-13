import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapSessionEvolutionToResponse } from "../../../../../infraestructure/mappers/map-session-evolution";
import { updateSessionEvolutionSchema } from "../../schemas/update-session-evolution.schema";
import { UpdateSessionEvolutionUseCase } from "./update-session-evolution-use-case";

export class UpdateSessionEvolutionController extends BaseController {
  constructor(private useCase: UpdateSessionEvolutionUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await updateSessionEvolutionSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: educator.id,
      evolutionId: req.params.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "EVOLUTION_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "PLAN_NOT_EDITABLE":
          return this.conflict(res, result.error);
        default:
          return this.clientError(res, result.error);
      }
    }

    return this.ok(res, mapSessionEvolutionToResponse(result.value));
  }
}
