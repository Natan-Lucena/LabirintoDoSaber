import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { mapAnamneseResponse } from "../../../../../infraestructure/mappers/map-anamnese-response";
import { ListAnamneseResponsesByStudentUseCase } from "./list-anamnese-responses-by-student-use-case";

export class ListAnamneseResponsesByStudentController extends BaseController {
  constructor(private useCase: ListAnamneseResponsesByStudentUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const result = await this.useCase.execute({
      educatorId: user.id,
      studentId: String(req.params.studentId),
    });

    if (!result.ok) {
      switch (result.error) {
        case "STUDENT_NOT_FOUND":
          return this.notFound(res, result.error);
        case "UNAUTHORIZED":
          return this.forbidden(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    return this.ok(res, result.value.map(mapAnamneseResponse));
  }
}
