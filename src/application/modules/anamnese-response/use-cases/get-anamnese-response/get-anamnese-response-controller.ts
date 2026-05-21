import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GetAnamneseResponseUseCase } from "./get-anamnese-response-use-case";

export class GetAnamneseResponseController extends BaseController {
  constructor(private useCase: GetAnamneseResponseUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const result = await this.useCase.execute({
      responseId: req.params.responseId,
      educatorId: user.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "RESPONSE_NOT_FOUND":
          return this.notFound(res, "RESPONSE_NOT_FOUND");
        case "UNAUTHORIZED":
          return this.unauthorized(res);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
