import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { ListAnamneseResponsesByStudentUseCase } from "./list-anamnese-responses-by-student-use-case";

export class ListAnamneseResponsesByStudentController extends BaseController {
  constructor(private useCase: ListAnamneseResponsesByStudentUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const result = await this.useCase.execute({
      studentId: req.params.studentId,
    });

    return this.ok(res, result.value);
  }
}
