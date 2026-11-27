import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapClinicViewToResponse } from "../../../../../infraestructure/mappers/map-clinic";
import { updateClinicSchema } from "../../schemas/clinic-schemas";
import { UpdateClinicUseCase } from "./update-clinic-use-case";

export class UpdateClinicController extends BaseController {
  constructor(private useCase: UpdateClinicUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await updateClinicSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      name: validation.data.name,
    });

    if (!result.ok) {
      switch (result.error) {
        case "NOT_IN_CLINIC":
          return this.notFound(res, result.error);
        case "FORBIDDEN_ROLE":
          return this.forbidden(res, result.error);
        case "INVALID_CLINIC_NAME":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, mapClinicViewToResponse(result.value));
  }
}
