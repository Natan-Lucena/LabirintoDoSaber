import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapClinicInviteToResponse } from "../../../../../infraestructure/mappers/map-clinic";
import { ListClinicInvitesUseCase } from "./list-clinic-invites-use-case";

export class ListClinicInvitesController extends BaseController {
  constructor(private useCase: ListClinicInvitesUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: educator.id,
    });

    if (!result.ok) {
      switch (result.error) {
        case "NOT_IN_CLINIC":
          return this.notFound(res, result.error);
        case "FORBIDDEN_ROLE":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    const { invites, clinic } = result.value;
    return this.ok(res, invites.map((invite) => mapClinicInviteToResponse(invite, clinic.name)));
  }
}
