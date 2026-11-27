import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapClinicViewToResponse } from "../../../../../infraestructure/mappers/map-clinic";
import { GetClinicUseCase } from "./get-clinic-use-case";

export class GetClinicController extends BaseController {
  constructor(private useCase: GetClinicUseCase) {
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
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, mapClinicViewToResponse(result.value));
  }
}
