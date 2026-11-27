import { describe, it, expect, vi } from "vitest";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { AcceptPlanSuggestionController } from "./accept-plan-suggestion-controller";
import { runController } from "../../../controller-test-helper";

const answer = (error: string) =>
  runController(
    new AcceptPlanSuggestionController({
      execute: vi.fn().mockResolvedValue(failure(error)),
    } as any),
    { params: { id: Uuid.random().value } }
  );

describe("AcceptPlanSuggestionController", () => {
  it("should answer 409 when the suggestion points to a goal that left the plan", async () => {
    // A meta foi removida depois da sugestão: conflito de estado, como
    // SUGGESTION_NOT_APPLICABLE; a sugestão em si existe.
    expect(await answer("GOAL_NOT_FOUND")).toEqual({
      status: 409,
      body: { message: "GOAL_NOT_FOUND" },
    });
  });

  it("should map the other errors", async () => {
    expect(await answer("SUGGESTION_NOT_FOUND")).toMatchObject({ status: 404 });
    expect(await answer("PLAN_NOT_FOUND")).toMatchObject({ status: 404 });
    expect(await answer("UNAUTHORIZED")).toMatchObject({ status: 403 });
    expect(await answer("SUGGESTION_NOT_APPLICABLE")).toMatchObject({ status: 409 });
    expect(await answer("SUGGESTION_ALREADY_RESOLVED")).toMatchObject({ status: 409 });
  });
});
