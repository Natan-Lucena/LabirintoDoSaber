import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  CreatePlanProps,
  GoalStatus,
  Plan,
  PlanSource,
  PlanStatus,
  PlanType,
} from "../../entities/plan";
import { PlanReview } from "../../entities/plan-review";

const makePdiProps = (
  overrides: Partial<CreatePlanProps> = {}
): CreatePlanProps => ({
  educatorId: Uuid.random(),
  studentId: Uuid.random(),
  type: PlanType.PDI,
  source: PlanSource.MANUAL,
  title: "PDI de leitura",
  generalObjective: "Ler frases curtas com autonomia",
  startDate: "2026-11-01",
  endDate: "2027-05-01",
  goals: [
    { description: "Ler sílabas simples" },
    { description: "Ler palavras de duas sílabas", successCriterion: "8 de 10" },
    { description: "Ler frases curtas" },
  ],
  ...overrides,
});

const makePdi = (overrides: Partial<CreatePlanProps> = {}) => {
  const result = Plan.create(makePdiProps(overrides));
  if (!result.ok) throw new Error(`unexpected ${result.error}`);
  return result.value;
};

const unwrap = <T>(result: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!result.ok) throw new Error(`unexpected ${String(result.error)}`);
  return result.value as T;
};

describe("Plan Entity", () => {
  describe("create", () => {
    it("should create an ACTIVE PDI with ordered NOT_STARTED goals", () => {
      const plan = makePdi();

      expect(plan.status).toBe(PlanStatus.ACTIVE);
      expect(plan.goals.map((g) => g.order)).toEqual([0, 1, 2]);
      expect(plan.goals.every((g) => g.status === GoalStatus.NOT_STARTED)).toBe(
        true
      );
      expect(plan.consideredDifficulties).toEqual([]);
      expect(plan.closedAt).toBeUndefined();
    });

    it("should fill PE dates with the session date", () => {
      const result = Plan.create(
        makePdiProps({
          type: PlanType.PE,
          startDate: undefined,
          endDate: undefined,
          sessionDate: "2026-11-10",
        })
      );

      const plan = unwrap<Plan>(result);
      expect(plan.startDate).toBe("2026-11-10");
      expect(plan.endDate).toBe("2026-11-10");
    });

    it("should require sessionDate on PE", () => {
      const result = Plan.create(makePdiProps({ type: PlanType.PE }));

      expect(result).toEqual({ ok: false, error: "SESSION_DATE_REQUIRED" });
    });

    it("should reject PE-only fields on PDI", () => {
      expect(Plan.create(makePdiProps({ sessionDate: "2026-11-10" }))).toEqual({
        ok: false,
        error: "INVALID_FIELDS_FOR_PDI",
      });
      expect(Plan.create(makePdiProps({ parentPlanId: Uuid.random() }))).toEqual(
        { ok: false, error: "INVALID_FIELDS_FOR_PDI" }
      );
      expect(
        Plan.create(makePdiProps({ appointmentId: Uuid.random() }))
      ).toEqual({ ok: false, error: "INVALID_FIELDS_FOR_PDI" });
    });

    it("should reject plans without goals or with more than 10", () => {
      expect(Plan.create(makePdiProps({ goals: [] }))).toEqual({
        ok: false,
        error: "PLAN_WITHOUT_GOALS",
      });

      const elevenGoals = Array.from({ length: 11 }, (_, i) => ({
        description: `Meta ${i}`,
      }));
      expect(Plan.create(makePdiProps({ goals: elevenGoals }))).toEqual({
        ok: false,
        error: "TOO_MANY_GOALS",
      });
    });

    it.each([
      ["endDate equal to startDate", { endDate: "2026-11-01" }],
      ["endDate before startDate", { endDate: "2026-10-01" }],
      ["date that does not exist", { startDate: "2026-02-30" }],
      ["missing endDate", { endDate: undefined }],
      ["nextReviewDate before start", { nextReviewDate: "2026-10-31" }],
      ["nextReviewDate after end", { nextReviewDate: "2027-05-02" }],
    ])("should reject %s with INVALID_DATES", (_, overrides) => {
      expect(Plan.create(makePdiProps(overrides))).toEqual({
        ok: false,
        error: "INVALID_DATES",
      });
    });

    it("should accept nextReviewDate on the vigency boundaries", () => {
      expect(Plan.create(makePdiProps({ nextReviewDate: "2026-11-01" })).ok).toBe(
        true
      );
      expect(Plan.create(makePdiProps({ nextReviewDate: "2027-05-01" })).ok).toBe(
        true
      );
    });
  });

  describe("progress", () => {
    it("should count achieved goals over non-discontinued goals", () => {
      let plan = makePdi({
        goals: [
          { description: "A" },
          { description: "B" },
          { description: "C" },
          { description: "D" },
        ],
      });
      const [a, b, c] = plan.goals.map((g) => g.id.value);

      plan = unwrap<Plan>(plan.changeGoalStatus(a, GoalStatus.ACHIEVED));
      plan = unwrap<Plan>(plan.changeGoalStatus(b, GoalStatus.IN_PROGRESS));
      plan = unwrap<Plan>(plan.changeGoalStatus(c, GoalStatus.DISCONTINUED));

      expect(plan.progress).toEqual({
        totalGoals: 3,
        achievedGoals: 1,
        inProgressGoals: 1,
        percent: 33,
      });
    });

    it("should be 0 when every goal is discontinued", () => {
      let plan = makePdi({ goals: [{ description: "A" }] });
      plan = unwrap<Plan>(
        plan.changeGoalStatus(plan.goals[0].id.value, GoalStatus.DISCONTINUED)
      );

      expect(plan.progress).toEqual({
        totalGoals: 0,
        achievedGoals: 0,
        inProgressGoals: 0,
        percent: 0,
      });
    });
  });

  describe("changeGoalStatus", () => {
    it("should set achievedAt when ACHIEVED and clear it when leaving", () => {
      const plan = makePdi();
      const goalId = plan.goals[0].id.value;

      const achieved = unwrap<Plan>(
        plan.changeGoalStatus(goalId, GoalStatus.ACHIEVED)
      );
      expect(achieved.goals[0].achievedAt).toBeInstanceOf(Date);

      const reopened = unwrap<Plan>(
        achieved.changeGoalStatus(goalId, GoalStatus.IN_PROGRESS)
      );
      expect(reopened.goals[0].achievedAt).toBeUndefined();
    });

    it("should return GOAL_NOT_FOUND for unknown goal", () => {
      const plan = makePdi();

      expect(
        plan.changeGoalStatus(Uuid.random().value, GoalStatus.ACHIEVED)
      ).toEqual({ ok: false, error: "GOAL_NOT_FOUND" });
    });

    it("should not mutate the original plan", () => {
      const plan = makePdi();
      plan.changeGoalStatus(plan.goals[0].id.value, GoalStatus.ACHIEVED);

      expect(plan.goals[0].status).toBe(GoalStatus.NOT_STARTED);
    });
  });

  describe("update", () => {
    it("should update, create and remove goals from the full list", () => {
      const plan = makePdi();
      const [first, , third] = plan.goals;

      const updated = unwrap<Plan>(
        plan.update({
          title: "Novo título",
          goals: [
            { id: third.id.value, description: "Terceira reescrita" },
            { description: "Meta nova" },
            { id: first.id.value, description: first.description },
          ],
        })
      );

      expect(updated.title).toBe("Novo título");
      expect(updated.goals.map((g) => g.description)).toEqual([
        "Terceira reescrita",
        "Meta nova",
        first.description,
      ]);
      expect(updated.goals.map((g) => g.order)).toEqual([0, 1, 2]);
      expect(updated.goals[0].id.value).toBe(third.id.value);
      expect(updated.goals[1].status).toBe(GoalStatus.NOT_STARTED);
    });

    it("should keep goal status when updating its text", () => {
      const plan = makePdi();
      const goalId = plan.goals[0].id.value;
      const inProgress = unwrap<Plan>(
        plan.changeGoalStatus(goalId, GoalStatus.IN_PROGRESS)
      );

      const updated = unwrap<Plan>(
        inProgress.update({
          goals: [{ id: goalId, description: "Texto novo" }],
        })
      );

      expect(updated.goals[0].status).toBe(GoalStatus.IN_PROGRESS);
    });

    it("should refuse removing an ACHIEVED goal", () => {
      const plan = makePdi();
      const [first, second] = plan.goals;
      const achieved = unwrap<Plan>(
        plan.changeGoalStatus(first.id.value, GoalStatus.ACHIEVED)
      );

      expect(
        achieved.update({
          goals: [{ id: second.id.value, description: second.description }],
        })
      ).toEqual({ ok: false, error: "GOAL_ACHIEVED_CANNOT_BE_REMOVED" });
    });

    it("should return GOAL_NOT_FOUND for an id outside the plan", () => {
      const plan = makePdi();

      expect(
        plan.update({
          goals: [{ id: Uuid.random().value, description: "x" }],
        })
      ).toEqual({ ok: false, error: "GOAL_NOT_FOUND" });
    });

    it("should validate goal count and dates", () => {
      const plan = makePdi();

      expect(plan.update({ goals: [] })).toEqual({
        ok: false,
        error: "PLAN_WITHOUT_GOALS",
      });
      expect(plan.update({ endDate: "2026-10-01" })).toEqual({
        ok: false,
        error: "INVALID_DATES",
      });
      expect(plan.update({ nextReviewDate: "2028-01-01" })).toEqual({
        ok: false,
        error: "INVALID_DATES",
      });

      const elevenGoals = Array.from({ length: 11 }, (_, i) => ({
        description: `Meta ${i}`,
      }));
      expect(plan.update({ goals: elevenGoals })).toEqual({
        ok: false,
        error: "TOO_MANY_GOALS",
      });
    });

    it("should refuse the same goal id twice", () => {
      const plan = makePdi();
      const goalId = plan.goals[0].id.value;

      expect(
        plan.update({
          goals: [
            { id: goalId, description: "x" },
            { id: goalId, description: "y" },
          ],
        })
      ).toEqual({ ok: false, error: "DUPLICATE_GOAL_ID" });
    });

    it("should refuse changing the PE end date away from the session date", () => {
      const pe = unwrap<Plan>(
        Plan.create(
          makePdiProps({
            type: PlanType.PE,
            startDate: undefined,
            endDate: undefined,
            sessionDate: "2026-11-10",
          })
        )
      );

      expect(pe.update({ endDate: "2026-12-01" })).toEqual({
        ok: false,
        error: "INVALID_DATES",
      });
    });
  });

  describe("close", () => {
    it("should close an ACTIVE plan and set closedAt", () => {
      const plan = makePdi();

      const closed = unwrap<Plan>(plan.close(PlanStatus.COMPLETED));

      expect(closed.status).toBe(PlanStatus.COMPLETED);
      expect(closed.closedAt).toBeInstanceOf(Date);
      expect(closed.isEditable).toBe(false);
    });

    it("should make the plan read-only", () => {
      const closed = unwrap<Plan>(makePdi().close(PlanStatus.CANCELLED));
      const goalId = closed.goals[0].id.value;

      expect(closed.close(PlanStatus.COMPLETED)).toEqual({
        ok: false,
        error: "PLAN_NOT_EDITABLE",
      });
      expect(closed.update({ title: "x" })).toEqual({
        ok: false,
        error: "PLAN_NOT_EDITABLE",
      });
      expect(closed.changeGoalStatus(goalId, GoalStatus.ACHIEVED)).toEqual({
        ok: false,
        error: "PLAN_NOT_EDITABLE",
      });
      expect(closed.review("nota")).toEqual({
        ok: false,
        error: "PLAN_NOT_EDITABLE",
      });
      expect(closed.addGoal({ description: "x" })).toEqual({
        ok: false,
        error: "PLAN_NOT_EDITABLE",
      });
    });
  });

  describe("review", () => {
    it("should snapshot goal statuses and update nextReviewDate", () => {
      const plan = makePdi();
      const goalId = plan.goals[0].id.value;
      const achieved = unwrap<Plan>(
        plan.changeGoalStatus(goalId, GoalStatus.ACHIEVED)
      );

      const { plan: reviewed, review } = unwrap<{
        plan: Plan;
        review: PlanReview;
      }>(achieved.review("Evoluiu bem", "2027-01-15"));

      expect(reviewed.nextReviewDate).toBe("2027-01-15");
      expect(review.planId.value).toBe(plan.id.value);
      expect(review.note).toBe("Evoluiu bem");
      expect(review.goalStatuses).toHaveLength(3);
      expect(review.goalStatuses[0]).toEqual({
        goalId: achieved.goals[0].id,
        status: GoalStatus.ACHIEVED,
      });
    });

    it("should reject nextReviewDate outside the vigency", () => {
      expect(makePdi().review("nota", "2028-01-01")).toEqual({
        ok: false,
        error: "INVALID_DATES",
      });
    });
  });

  describe("addGoal", () => {
    it("should append a goal with the next order", () => {
      const plan = unwrap<Plan>(makePdi().addGoal({ description: "Nova" }));

      expect(plan.goals).toHaveLength(4);
      expect(plan.goals[3].order).toBe(3);
      expect(plan.goals[3].status).toBe(GoalStatus.NOT_STARTED);
    });

    it("should refuse more than 10 goals", () => {
      const tenGoals = Array.from({ length: 10 }, (_, i) => ({
        description: `Meta ${i}`,
      }));

      expect(makePdi({ goals: tenGoals }).addGoal({ description: "x" })).toEqual(
        { ok: false, error: "TOO_MANY_GOALS" }
      );
    });
  });
});
