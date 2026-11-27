import {
  BaseController,
  formatValidationErrors,
} from "@wave-telecom/framework/controllers";
import { AssignEducatorUseCase } from "./assign-educator-use-case";
import { Request, Response } from "express";
import { assignStudentSchema } from "../../schemas/assign-student-schema";
import { Uuid } from "@wave-telecom/framework/core";

export class AssignEducatorController extends BaseController {
  constructor(private assignEducatorUseCase: AssignEducatorUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const validation = await assignStudentSchema.safeParseAsync({
      ...req.body,
      ...req.params,
    });

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      return this.clientError(res, undefined, errors);
    }

    const payload = validation.data;
    const educator = req.user;
    if (!educator) {
      return this.unauthorized(res);
    }
    const result = await this.assignEducatorUseCase.execute({
      educatorId: educator.id,
      studentId: new Uuid(payload.studentId),
      newEducatorEmail: payload.newEducatorEmail,
    });

    if (!result.ok) {
      if (result.error === "STUDENT_NOT_FOUND") {
        return this.notFound(res, "STUDENT_NOT_FOUND");
      }
      if (result.error === "STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR") {
        return this.clientError(
          res,
          "STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR"
        );
      }
      if (result.error === "NEW_EDUCATOR_NOT_FOUND") {
        return this.notFound(res, "NEW_EDUCATOR_NOT_FOUND");
      }
      if (result.error === "NOT_IN_SAME_CLINIC") {
        return this.clientError(res, "NOT_IN_SAME_CLINIC");
      }
      return this.fail(res, result.error);
    }
    return this.ok(res, result.value);
  }
}
