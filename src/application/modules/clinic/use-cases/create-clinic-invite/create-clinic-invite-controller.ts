import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapClinicInviteToResponse } from "../../../../../infraestructure/mappers/map-clinic";
import { createClinicInviteSchema } from "../../schemas/clinic-schemas";
import { CreateClinicInviteUseCase } from "./create-clinic-invite-use-case";

export class CreateClinicInviteController extends BaseController {
  constructor(private useCase: CreateClinicInviteUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await createClinicInviteSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      role: validation.data.role,
    });

    if (!result.ok) {
      switch (result.error) {
        case "NOT_IN_CLINIC":
          return this.notFound(res, result.error);
        case "FORBIDDEN_ROLE":
          return this.forbidden(res, result.error);
        case "TOO_MANY_INVITES":
          return this.conflict(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    const { invite, clinic } = result.value;
    return this.created(res, mapClinicInviteToResponse(invite, clinic.name));
  }
}
