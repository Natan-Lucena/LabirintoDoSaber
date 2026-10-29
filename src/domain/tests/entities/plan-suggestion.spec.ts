import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GoalStatus, Plan, PlanSource, PlanType } from "../../entities/plan";
import {
  CreatePlanSuggestionProps,
  PlanSuggestion,
  SuggestionKind,
  SuggestionStatus,
} from "../../entities/plan-suggestion";

const INVALID = { ok: false, error: "INVALID_SUGGESTION" };

describe("PlanSuggestion", () => {
  let plan: Plan;

  const goalId = () => plan.goals[0].id.value;

  const create = (input: CreatePlanSuggestionProps) => PlanSuggestion.create(plan, input);

  const valid = (input: CreatePlanSuggestionProps) => {
    const result = create(input);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };

  beforeEach(() => {
    const created = Plan.create({
      educatorId: Uuid.random(),
      studentId: Uuid.random(),
      type: PlanType.PDI,
      source: PlanSource.MANUAL,
      title: "PDI",
      generalObjective: "Objetivo",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      nextReviewDate: "2026-02-01",
      goals: [{ description: "Ler sílabas", successCriterion: "8 de 10" }],
    });
    if (!created.ok) throw new Error(created.error);
    plan = created.value;
  });

  describe("create", () => {
    it("creates a PENDING suggestion linked to the plan", () => {
      const suggestion = valid({
        kind: SuggestionKind.UPDATE_GOAL_STATUS,
        goalId: goalId(),
        text: "  A meta está em andamento.  ",
        proposedChange: { status: GoalStatus.IN_PROGRESS, description: "ignorado" },
      });

      expect(suggestion.status).toBe(SuggestionStatus.PENDING);
      expect(suggestion.planId.value).toBe(plan.id.value);
      expect(suggestion.educatorId.value).toBe(plan.educatorId.value);
      expect(suggestion.studentId.value).toBe(plan.studentId.value);
      expect(suggestion.goalId?.value).toBe(goalId());
      expect(suggestion.text).toBe("A meta está em andamento.");
      expect(suggestion.proposedChange).toEqual({ status: GoalStatus.IN_PROGRESS });
      expect(suggestion.resolvedAt).toBeUndefined();
    });

    it("rejects an unknown kind, an empty text and a text over 500", () => {
      const base = { kind: SuggestionKind.ADD_GOAL, proposedChange: { description: "Meta" } };

      expect(create({ ...base, kind: "OTHER", text: "x" })).toEqual(INVALID);
      expect(create({ ...base, text: "   " })).toEqual(INVALID);
      expect(create({ ...base, text: "t".repeat(501) })).toEqual(INVALID);
      expect(create({ ...base, text: "t".repeat(500) }).ok).toBe(true);
    });

    describe("UPDATE_GOAL_STATUS", () => {
      const text = "Mudar status.";

      it("rejects a missing or invented goal", () => {
        const proposedChange = { status: GoalStatus.ACHIEVED };
        expect(
          create({ kind: SuggestionKind.UPDATE_GOAL_STATUS, text, proposedChange })
        ).toEqual(INVALID);
        expect(
          create({
            kind: SuggestionKind.UPDATE_GOAL_STATUS,
            goalId: Uuid.random().value,
            text,
            proposedChange,
          })
        ).toEqual(INVALID);
      });

      it("rejects a missing or invalid status", () => {
        expect(
          create({ kind: SuggestionKind.UPDATE_GOAL_STATUS, goalId: goalId(), text })
        ).toEqual(INVALID);
        expect(
          create({
            kind: SuggestionKind.UPDATE_GOAL_STATUS,
            goalId: goalId(),
            text,
            proposedChange: { status: "DONE" },
          })
        ).toEqual(INVALID);
      });

      it("rejects the current status of the goal (no effect)", () => {
        expect(
          create({
            kind: SuggestionKind.UPDATE_GOAL_STATUS,
            goalId: goalId(),
            text,
            proposedChange: { status: GoalStatus.NOT_STARTED },
          })
        ).toEqual(INVALID);
      });
    });

    describe("ADD_GOAL", () => {
      it("keeps description and success criterion, ignoring goalId", () => {
        const suggestion = valid({
          kind: SuggestionKind.ADD_GOAL,
          goalId: goalId(),
          text: "Incluir meta.",
          proposedChange: { description: "Identificar rimas", successCriterion: "4 de 5" },
        });

        expect(suggestion.goalId).toBeUndefined();
        expect(suggestion.proposedChange).toEqual({
          description: "Identificar rimas",
          successCriterion: "4 de 5",
        });
      });

      it("rejects a missing description or texts over 500", () => {
        const kind = SuggestionKind.ADD_GOAL;
        const text = "Incluir meta.";

        expect(create({ kind, text, proposedChange: { description: " " } })).toEqual(INVALID);
        expect(
          create({ kind, text, proposedChange: { description: "d".repeat(501) } })
        ).toEqual(INVALID);
        expect(
          create({
            kind,
            text,
            proposedChange: { description: "Meta", successCriterion: "c".repeat(501) },
          })
        ).toEqual(INVALID);
      });
    });

    describe("REWRITE_GOAL", () => {
      it("accepts a rewrite of an existing goal", () => {
        const suggestion = valid({
          kind: SuggestionKind.REWRITE_GOAL,
          goalId: goalId(),
          text: "Deixar mensurável.",
          proposedChange: { description: "Ler 10 sílabas simples" },
        });

        expect(suggestion.goalId?.value).toBe(goalId());
        expect(suggestion.proposedChange).toEqual({
          description: "Ler 10 sílabas simples",
          successCriterion: undefined,
        });
      });

      it("rejects an invented goal or a missing description", () => {
        expect(
          create({
            kind: SuggestionKind.REWRITE_GOAL,
            goalId: Uuid.random().value,
            text: "Reescrever.",
            proposedChange: { description: "Nova" },
          })
        ).toEqual(INVALID);
        expect(
          create({
            kind: SuggestionKind.REWRITE_GOAL,
            goalId: goalId(),
            text: "Reescrever.",
            proposedChange: {},
          })
        ).toEqual(INVALID);
      });
    });

    describe("SCHEDULE_REVIEW", () => {
      const schedule = (nextReviewDate?: string) =>
        create({
          kind: SuggestionKind.SCHEDULE_REVIEW,
          text: "Revisar.",
          proposedChange: { nextReviewDate },
        });

      it("accepts a date inside the plan period, including the edges", () => {
        expect(schedule("2026-03-15").ok).toBe(true);
        expect(schedule("2026-01-01").ok).toBe(true);
        expect(schedule("2026-06-30").ok).toBe(true);
      });

      it("rejects missing, invalid or out-of-period dates", () => {
        expect(schedule(undefined)).toEqual(INVALID);
        expect(schedule("2026-02-30")).toEqual(INVALID);
        expect(schedule("15/03/2026")).toEqual(INVALID);
        expect(schedule("2025-12-31")).toEqual(INVALID);
        expect(schedule("2026-07-01")).toEqual(INVALID);
      });

      it("rejects the current review date (no effect)", () => {
        expect(schedule("2026-02-01")).toEqual(INVALID);
      });
    });
  });

  describe("accept and dismiss", () => {
    let suggestion: PlanSuggestion;

    beforeEach(() => {
      suggestion = valid({
        kind: SuggestionKind.ADD_GOAL,
        text: "Incluir meta.",
        proposedChange: { description: "Meta nova" },
      });
    });

    it("accept marks ACCEPTED with resolvedAt, without changing the original", () => {
      const result = suggestion.accept();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe(SuggestionStatus.ACCEPTED);
      expect(result.value.resolvedAt).toBeInstanceOf(Date);
      expect(suggestion.status).toBe(SuggestionStatus.PENDING);
    });

    it("dismiss marks DISMISSED with resolvedAt", () => {
      const result = suggestion.dismiss();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe(SuggestionStatus.DISMISSED);
      expect(result.value.resolvedAt).toBeInstanceOf(Date);
    });

    it("returns SUGGESTION_ALREADY_RESOLVED once resolved", () => {
      const accepted = suggestion.accept();
      const dismissed = suggestion.dismiss();
      if (!accepted.ok || !dismissed.ok) throw new Error("setup");

      const expected = { ok: false, error: "SUGGESTION_ALREADY_RESOLVED" };
      expect(accepted.value.accept()).toEqual(expected);
      expect(accepted.value.dismiss()).toEqual(expected);
      expect(dismissed.value.accept()).toEqual(expected);
      expect(dismissed.value.dismiss()).toEqual(expected);
    });
  });
});
