import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { GenerateAuthTokenUseCase } from "./generate-auth-token-use-case";
import { Request, Response } from "express";
import { generateAuthTokenSchema } from "../../schemas/generate-auth-token-schema";

export class GenerateAuthTokenController extends BaseController {
  constructor(private useCase: GenerateAuthTokenUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const validation = await generateAuthTokenSchema.safeParseAsync(req.body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute(validation.data.email);

    if (!result.ok) {
      switch (result.error) {
        case "TOO_MANY_REQUESTS":
          return res.status(429).json({ message: result.error });
        default:
          return this.fail(res, "INTERNAL_ERROR");
      }
    }

    return this.ok(res, { message: "TOKEN_SENT" });
  }
}
