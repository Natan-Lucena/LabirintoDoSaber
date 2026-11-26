import { describe, it, expect, vi } from "vitest";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { AssignEducatorController } from "./assign-educator-controller";
import { runController } from "../../../controller-test-helper";

const answer = (error: string) =>
  runController(
    new AssignEducatorController({
      execute: vi.fn().mockResolvedValue(failure(error)),
    } as any),
    { body: { studentId: Uuid.random().value, newEducatorEmail: "nova@mail.com" } }
  );

describe("AssignEducatorController", () => {
  it("should answer 404 when the student or the new educator does not exist (PP-11)", async () => {
    for (const error of ["STUDENT_NOT_FOUND", "NEW_EDUCATOR_NOT_FOUND"]) {
      expect(await answer(error)).toEqual({ status: 404, body: { message: error } });
    }
  });

  it("should keep the business errors as 400", async () => {
    for (const error of ["STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR", "NOT_IN_SAME_CLINIC"]) {
      expect(await answer(error)).toEqual({ status: 400, body: { message: error } });
    }
  });
});
