import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GetEvolutionContextUseCase } from "./get-evolution-context-use-case";

export class GetEvolutionContextController extends BaseController {
  constructor(private useCase: GetEvolutionContextUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: educator.id,
      sessionId: req.params.sessionId,
    });

    if (!result.ok) {
      switch (result.error) {
        case "SESSION_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "SESSION_NOT_FINISHED":
          return this.conflict(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
