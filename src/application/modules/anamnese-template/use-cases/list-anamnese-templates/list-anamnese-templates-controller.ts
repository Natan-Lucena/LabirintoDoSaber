import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { ListAnamneseTemplatesUseCase } from "./list-anamnese-templates-use-case";

export class ListAnamneseTemplatesController extends BaseController {
  constructor(private useCase: ListAnamneseTemplatesUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const result = await this.useCase.execute({ educatorId: user.id });
    return this.ok(res, result.value);
  }
}
