import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapClinicViewToResponse } from "../../../../../infraestructure/mappers/map-clinic";
import { clientIp } from "../../../../../infraestructure/http/client-ip";
import { acceptClinicInviteSchema } from "../../schemas/clinic-schemas";
import { AcceptClinicInviteUseCase } from "./accept-clinic-invite-use-case";

export class AcceptClinicInviteController extends BaseController {
  constructor(private useCase: AcceptClinicInviteUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await acceptClinicInviteSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      code: validation.data.code,
      ip: clientIp(req),
    });

    if (!result.ok) {
      switch (result.error) {
        case "INVITE_INVALID":
          return this.notFound(res, result.error);
        case "ALREADY_IN_CLINIC":
          return this.conflict(res, result.error);
        case "TOO_MANY_REQUESTS":
          return this.tooMany(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, mapClinicViewToResponse(result.value));
  }
}
