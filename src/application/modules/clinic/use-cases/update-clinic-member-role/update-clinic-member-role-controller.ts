import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapClinicViewToResponse } from "../../../../../infraestructure/mappers/map-clinic";
import { updateClinicMemberRoleSchema } from "../../schemas/clinic-schemas";
import { UpdateClinicMemberRoleUseCase } from "./update-clinic-member-role-use-case";

export class UpdateClinicMemberRoleController extends BaseController {
  constructor(private useCase: UpdateClinicMemberRoleUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;
    if (!educator) return this.unauthorized(res);

    const validation = await updateClinicMemberRoleSchema.safeParseAsync(req.body);
    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const result = await this.useCase.execute({
      educatorId: educator.id,
      targetEducatorId: String(req.params.educatorId),
      role: validation.data.role,
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

    return this.ok(res, mapClinicViewToResponse(result.value));
  }
}
