import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { RevokeClinicInviteUseCase } from "./revoke-clinic-invite-use-case";

export class RevokeClinicInviteController extends BaseController {
  constructor(private useCase: RevokeClinicInviteUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: educator.id,
      inviteId: String(req.params.id),
    });

    if (!result.ok) {
      switch (result.error) {
        case "NOT_IN_CLINIC":
        case "INVITE_NOT_FOUND":
          return this.notFound(res, result.error);
        case "FORBIDDEN_ROLE":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.noContent(res);
  }
}
