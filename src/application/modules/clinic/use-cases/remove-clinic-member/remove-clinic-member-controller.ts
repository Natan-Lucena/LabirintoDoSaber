import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { RemoveClinicMemberUseCase } from "./remove-clinic-member-use-case";

export class RemoveClinicMemberController extends BaseController {
  constructor(private useCase: RemoveClinicMemberUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: educator.id,
      // O próprio id = sair da clínica.
      targetEducatorId: String(req.params.educatorId),
    });

    if (!result.ok) {
      switch (result.error) {
        case "NOT_IN_CLINIC":
        case "MEMBER_NOT_FOUND":
          return this.notFound(res, result.error);
        case "FORBIDDEN_ROLE":
          return this.forbidden(res, result.error);
        case "LAST_ADMIN":
          return this.conflict(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.noContent(res);
  }
}
