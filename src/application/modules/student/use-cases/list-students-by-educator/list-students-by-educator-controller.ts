import { BaseController } from "@wave-telecom/framework/controllers";
import { ListStudentsByEducatorUseCase } from "./list-students-by-educator-use-case";
import { Request, Response } from "express";

export class ListStudentsByEducatorController extends BaseController {
  constructor(private useCase: ListStudentsByEducatorUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const educator = req.user;

    if (!educator) {
      return this.unauthorized(res, "UNHAUTHORIZED");
    }

    const students = await this.useCase.execute({ educatorId: educator.id });
    return this.ok(res, students);
  }
}
