import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapClinicViewToResponse } from "../../../../../infraestructure/mappers/map-clinic";
import { createClinicSchema } from "../../schemas/clinic-schemas";
import { CreateClinicUseCase } from "./create-clinic-use-case";

export class CreateClinicController extends BaseController {
  constructor(private useCase: CreateClinicUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await createClinicSchema.safeParseAsync(req.body);
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
        case "ALREADY_IN_CLINIC":
          return this.conflict(res, result.error);
        case "INVALID_CLINIC_NAME":
          return this.clientError(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.created(res, mapClinicViewToResponse(result.value));
  }
}
