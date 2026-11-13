import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { GetReportOptionsUseCase } from "./get-report-options-use-case";

export class GetReportOptionsController extends BaseController {
  constructor(private useCase: GetReportOptionsUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    if (!req.user) return this.unauthorized(res);

    const result = this.useCase.execute();
    return this.ok(res, result.value);
  }
}
