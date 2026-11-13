import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapSessionEvolutionToResponse } from "../../../../../infraestructure/mappers/map-session-evolution";
import { GetSessionEvolutionUseCase } from "./get-session-evolution-use-case";

export class GetSessionEvolutionController extends BaseController {
  constructor(private useCase: GetSessionEvolutionUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
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
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, mapSessionEvolutionToResponse(result.value));
  }
}
