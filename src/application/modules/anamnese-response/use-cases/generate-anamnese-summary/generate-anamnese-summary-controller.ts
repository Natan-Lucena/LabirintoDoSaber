import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapAnamneseResponse } from "../../../../../infraestructure/mappers/map-anamnese-response";
import { GenerateAnamneseSummaryUseCase } from "./generate-anamnese-summary-use-case";

export class GenerateAnamneseSummaryController extends BaseController {
  constructor(private useCase: GenerateAnamneseSummaryUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: user.id,
      responseId: req.params.responseId,
    });

    if (!result.ok) {
      switch (result.error) {
        case "RESPONSE_NOT_FOUND":
        case "TEMPLATE_NOT_FOUND":
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        case "NO_ANSWERS_TO_SUMMARIZE":
          return this.clientError(res, result.error);
        case "AI_GENERATION_FAILED":
        case "AI_INVALID_OUTPUT":
          return this.fail(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, mapAnamneseResponse(result.value));
  }
}
