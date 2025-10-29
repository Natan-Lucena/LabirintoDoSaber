import {
    BaseController,
    formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { createTaskSchema } from "../schemas/create-task-schemas";
import { CreateTaskUseCase } from "./create-task-use-case";

export class CreateTaskController extends BaseController {
    constructor(private useCase: CreateTaskUseCase) {
        super();
    }

    async executeImpl(req: Request, res: Response): Promise<Response> {
        const validation = await createTaskSchema.safeParseAsync(req.body);

        if (!validation.success) {
            const errors = formatValidationErrors(validation.error);
            return this.clientError(res, undefined, errors);
        }

        const payload = validation.data;

        const result = await this.useCase.execute(payload);

        if (!result.ok) {
            if (result.error == "INVALID_TASK_DATA") {
                return this.clientError(res, "INVALID_TASK_DATA");
            }
            return this.fail(res, result.error);
        }

        return this.created(res);
    }


}