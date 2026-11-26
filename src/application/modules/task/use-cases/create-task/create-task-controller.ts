import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { createTaskSchema } from "../../schemas/create-task-schemas";
import { CreateTaskUseCase } from "./create-task-use-case";
import { sendTaskError } from "../task-rules";

// No multipart, alternatives, content e skills chegam como string JSON.
const parseJsonField = (body: Record<string, unknown>, field: string) => {
  if (typeof body[field] !== "string") return true;
  try {
    body[field] = JSON.parse(body[field] as string);
    return true;
  } catch {
    return false;
  }
};

export class CreateTaskController extends BaseController {
  constructor(private useCase: CreateTaskUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<Response> {
    const user = req.user;
    if (!user) return this.unauthorized(res);

    const body = { ...(req.body ?? {}) };

    if (!parseJsonField(body, "alternatives")) {
      return this.clientError(res, "INVALID_ALTERNATIVES_FORMAT");
    }
    if (!parseJsonField(body, "content")) {
      return res.status(400).json({
        message: "INVALID_CONTENT",
        errors: [{ field: "content", message: "JSON inválido" }],
      });
    }
    if (!parseJsonField(body, "skills")) {
      return this.clientError(res, undefined, [
        { field: "skills", message: "Deve ser um array JSON de códigos" },
      ]);
    }

    const validation = await createTaskSchema.safeParseAsync(body);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const imageFile = req.files && (req.files as any).imageFile?.[0];
    const audioFile = req.files && (req.files as any).audioFile?.[0];

    const result = await this.useCase.execute({
      ...validation.data,
      educatorId: user.id,
      imageFile,
      audioFile,
    });

    if (!result.ok) return sendTaskError(res, result.error);

    return this.created(res, result.value);
  }
}
