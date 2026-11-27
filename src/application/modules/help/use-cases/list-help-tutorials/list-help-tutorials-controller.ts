import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { ListHelpTutorialsUseCase } from "./list-help-tutorials-use-case";

export class ListHelpTutorialsController extends BaseController {
  constructor(private useCase: ListHelpTutorialsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    if (!req.user) return this.unauthorized(res);

    const result = await this.useCase.execute();
    return this.ok(res, result.value);
  }
}
