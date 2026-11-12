import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { VerifyTokenUseCase } from "./verify-token-use-case";
import { verifyTokenSchema } from "../../schemas/verify-token-schema";

export class VerifyTokenController extends BaseController {
  constructor(private useCase: VerifyTokenUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const validation = await verifyTokenSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute(validation.data);

    if (!result.ok) {
      switch (result.error) {
        case "INVALID_TOKEN":
        case "EXPIRED_TOKEN":
          return this.clientError(res, result.error);
        case "TOO_MANY_ATTEMPTS":
          return res.status(429).json({ message: result.error });
        default:
          return this.fail(res, "INTERNAL_ERROR");
      }
    }

    return this.ok(res, result.value);
  }
}
