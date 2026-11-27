import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { ListTaskSkillsUseCase } from "./list-task-skills-use-case";

export class ListTaskSkillsController extends BaseController {
  constructor(private useCase: ListTaskSkillsUseCase) {
    super();
  }

  async executeImpl(_req: Request, res: Response): Promise<Response> {
    const result = await this.useCase.execute();
    return this.ok(res, result.value);
  }
}
