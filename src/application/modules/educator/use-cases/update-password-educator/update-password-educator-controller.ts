import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { UpdatePasswordEducatorUseCase } from "./update-password-educator-use-case";
import { updatePasswordEducatorSchema } from "../../schemas/update-password-educator-schema";

export class UpdatePasswordEducatorController extends BaseController {
    constructor(private useCase: UpdatePasswordEducatorUseCase) {
        super();
    }

    async executeImpl(req: Request, res: Response): Promise<Response> {
        const validation = await updatePasswordEducatorSchema.safeParseAsync(req.body);

        if (!validation.success) {
            const errors = formatValidationErrors(validation.error);
            return this.clientError(res, undefined, errors);
        }

        const payload = validation.data;

        const result = await this.useCase.execute(payload);

        if (!result.ok) {
            if (result.error == "EDUCATOR_NOT_FOUND") {
                return this.clientError(res, "EDUCATOR_NOT_FOUND");
            }
            if (result.error == "PASSWORD_SAME_AS_OLD") {
                return this.clientError(res, "PASSWORD_SAME_AS_OLD");
            }
        }

        return this.ok(res);
    }
}