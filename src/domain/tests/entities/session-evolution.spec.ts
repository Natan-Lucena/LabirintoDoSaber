import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  computeGoalChanges,
  CreateSessionEvolutionProps,
  CriterionResult,
  EvolutionCriterionInput,
  SessionEvolution,
} from "../../entities/session-evolution";
import {
  GoalStatus,
  Plan,
  PlanSource,
  PlanStatus,
  PlanType,
} from "../../entities/plan";
import { TaskNotebookSession } from "../../entities/task-notebook-session";

const unwrap = <T>(result: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!result.ok) throw new Error(`unexpected ${String(result.error)}`);
  return result.value as T;
};

const studentId = Uuid.random();
const educatorId = Uuid.random();

// 23:30 em São Paulo (UTC-3) = 02:30 UTC do dia seguinte.
const STARTED_AT = new Date("2026-11-11T02:30:00.000Z");
const FINISHED_AT = new Date("2026-11-11T03:15:20.000Z");

const makeSession = (
  overrides: { finishedAt?: Date | null; appointmentId?: Uuid } = {}
) =>
  new TaskNotebookSession(
    Uuid.random(),
    studentId,
    educatorId,
    "Sessão de leitura",
    STARTED_AT,
    overrides.finishedAt === null
      ? undefined
      : overrides.finishedAt ?? FINISHED_AT,
    [],
    undefined,
    undefined,
    overrides.appointmentId
  );

const makePlan = () =>
  unwrap<Plan>(
    Plan.create({
      educatorId,
      studentId,
      type: PlanType.PDI,
      source: PlanSource.MANUAL,
      title: "PDI de leitura",
      generalObjective: "Ler frases curtas",
      startDate: "2026-11-01",
      endDate: "2027-05-01",
      goals: [{ description: "Ler sílabas" }, { description: "Ler palavras" }],
    })
  );

const freeCriterion = (
  overrides: Partial<EvolutionCriterionInput> = {}
): EvolutionCriterionInput => ({
  description: "Leu as sílabas do cartão",
  result: CriterionResult.PARTIAL,
  ...overrides,
});

const makeProps = (
  overrides: Partial<CreateSessionEvolutionProps> = {}
): CreateSessionEvolutionProps => ({
  session: makeSession(),
  educatorId,
  criteria: [freeCriterion()],
  descriptiveRecord: "Registro da sessão",
  ...overrides,
});

describe("SessionEvolution Entity", () => {
  describe("create", () => {
    it("should derive sessionDate in São Paulo even when the session starts at 23:30", () => {
      const evolution = unwrap<SessionEvolution>(
        SessionEvolution.create(makeProps())
      );

      expect(evolution.sessionDate).toBe("2026-11-10");
    });

    it("should derive durationMinutes rounded from startedAt and finishedAt", () => {
      const evolution = unwrap<SessionEvolution>(
        SessionEvolution.create(makeProps())
      );

      expect(evolution.durationMinutes).toBe(45);
    });

    it("should round durationMinutes to the nearest minute", () => {
      const evolution = unwrap<SessionEvolution>(
        SessionEvolution.create(
          makeProps({
            session: makeSession({
              finishedAt: new Date(STARTED_AT.getTime() + 30 * 60000 + 31000),
            }),
          })
        )
      );

      expect(evolution.durationMinutes).toBe(31);
    });

    it("should inherit studentId and appointmentId from the session", () => {
      const appointmentId = Uuid.random();
      const session = makeSession({ appointmentId });

      const evolution = unwrap<SessionEvolution>(
        SessionEvolution.create(makeProps({ session }))
      );

      expect(evolution.sessionId.value).toBe(session.id.value);
      expect(evolution.studentId.value).toBe(studentId.value);
      expect(evolution.educatorId.value).toBe(educatorId.value);
      expect(evolution.appointmentId?.value).toBe(appointmentId.value);
    });

    it("should copy plan id, type and title and give each criterion a new id", () => {
      const plan = makePlan();

      const evolution = unwrap<SessionEvolution>(
        SessionEvolution.create(
          makeProps({
            plan,
            criteria: [
              freeCriterion({ goalId: plan.goals[0].id.value, attempts: 10, successes: 8 }),
              freeCriterion(),
            ],
          })
        )
      );

      expect(evolution.planId?.value).toBe(plan.id.value);
      expect(evolution.planType).toBe(PlanType.PDI);
      expect(evolution.planTitle).toBe("PDI de leitura");
      expect(evolution.criteria).toHaveLength(2);
      expect(evolution.criteria[0].goalId?.value).toBe(plan.goals[0].id.value);
      expect(evolution.criteria[0].id.value).not.toBe(evolution.criteria[1].id.value);
      expect(evolution.createdAt).toBeInstanceOf(Date);
    });

    it("should accept zero criteria", () => {
      const result = SessionEvolution.create(makeProps({ criteria: [] }));

      expect(result.ok).toBe(true);
    });

    it("should reject an open session", () => {
      const result = SessionEvolution.create(
        makeProps({ session: makeSession({ finishedAt: null }) })
      );

      expect(result).toEqual({ ok: false, error: "SESSION_NOT_FINISHED" });
    });

    it("should accept 20 criteria and reject 21", () => {
      const twenty = Array.from({ length: 20 }, () => freeCriterion());

      expect(SessionEvolution.create(makeProps({ criteria: twenty })).ok).toBe(true);
      expect(
        SessionEvolution.create(
          makeProps({ criteria: [...twenty, freeCriterion()] })
        )
      ).toEqual({ ok: false, error: "TOO_MANY_CRITERIA" });
    });

    it("should reject successes greater than attempts", () => {
      const result = SessionEvolution.create(
        makeProps({ criteria: [freeCriterion({ attempts: 5, successes: 6 })] })
      );

      expect(result).toEqual({ ok: false, error: "INVALID_ATTEMPTS" });
    });

    it("should reject successes without attempts", () => {
      const result = SessionEvolution.create(
        makeProps({ criteria: [freeCriterion({ successes: 2 })] })
      );

      expect(result).toEqual({ ok: false, error: "INVALID_ATTEMPTS" });
    });

    it("should reject attempts above 100", () => {
      const result = SessionEvolution.create(
        makeProps({ criteria: [freeCriterion({ attempts: 101 })] })
      );

      expect(result).toEqual({ ok: false, error: "INVALID_ATTEMPTS" });
    });

    it("should reject a criterion goal that is not in the plan", () => {
      const result = SessionEvolution.create(
        makeProps({
          plan: makePlan(),
          criteria: [freeCriterion({ goalId: Uuid.random().value })],
        })
      );

      expect(result).toEqual({ ok: false, error: "GOAL_NOT_IN_PLAN" });
    });

    it("should reject a criterion goal without a plan", () => {
      const result = SessionEvolution.create(
        makeProps({ criteria: [freeCriterion({ goalId: Uuid.random().value })] })
      );

      expect(result).toEqual({ ok: false, error: "GOAL_NOT_IN_PLAN" });
    });

    it("should reject goalUpdates for a goal outside the plan", () => {
      const result = SessionEvolution.create(
        makeProps({
          plan: makePlan(),
          goalUpdates: [{ goalId: Uuid.random().value, status: GoalStatus.ACHIEVED }],
        })
      );

      expect(result).toEqual({ ok: false, error: "GOAL_NOT_IN_PLAN" });
    });

    it("should reject goalUpdates without a plan", () => {
      const result = SessionEvolution.create(
        makeProps({
          goalUpdates: [{ goalId: Uuid.random().value, status: GoalStatus.ACHIEVED }],
        })
      );

      expect(result).toEqual({ ok: false, error: "INVALID_PLAN" });
    });
  });

  describe("update", () => {
    it("should replace the criteria with new ids and change updatedAt", async () => {
      const plan = makePlan();
      const evolution = unwrap<SessionEvolution>(
        SessionEvolution.create(makeProps({ plan }))
      );
      const oldCriterionId = evolution.criteria[0].id.value;

      await new Promise((resolve) => setTimeout(resolve, 5));

      const updated = unwrap<SessionEvolution>(
        evolution.update(
          {
            criteria: [
              freeCriterion({ goalId: plan.goals[1].id.value }),
              freeCriterion({ description: "Outro" }),
            ],
            descriptiveRecord: "Registro novo",
          },
          plan
        )
      );

      expect(updated.criteria).toHaveLength(2);
      expect(updated.criteria.map((c) => c.id.value)).not.toContain(oldCriterionId);
      expect(updated.descriptiveRecord).toBe("Registro novo");
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        evolution.updatedAt.getTime()
      );
      expect(updated.createdAt).toEqual(evolution.createdAt);
      expect(evolution.descriptiveRecord).toBe("Registro da sessão");
    });

    it("should keep fields that were not sent", () => {
      const evolution = unwrap<SessionEvolution>(
        SessionEvolution.create(
          makeProps({ nextSessionSuggestion: "Retomar sílabas" })
        )
      );

      const updated = unwrap<SessionEvolution>(
        evolution.update({ descriptiveRecord: "Outro registro" })
      );

      expect(updated.criteria).toEqual(evolution.criteria);
      expect(updated.nextSessionSuggestion).toBe("Retomar sílabas");
    });

    it("should apply the same validations as create", () => {
      const plan = makePlan();
      const evolution = unwrap<SessionEvolution>(
        SessionEvolution.create(makeProps({ plan }))
      );

      expect(
        evolution.update({ criteria: [freeCriterion({ attempts: 1, successes: 2 })] }, plan)
      ).toEqual({ ok: false, error: "INVALID_ATTEMPTS" });
      expect(
        evolution.update(
          { criteria: Array.from({ length: 21 }, () => freeCriterion()) },
          plan
        )
      ).toEqual({ ok: false, error: "TOO_MANY_CRITERIA" });
      expect(
        evolution.update(
          { criteria: [freeCriterion({ goalId: Uuid.random().value })] },
          plan
        )
      ).toEqual({ ok: false, error: "GOAL_NOT_IN_PLAN" });
    });

    it("should reject goalUpdates when the evolution has no plan", () => {
      const evolution = unwrap<SessionEvolution>(
        SessionEvolution.create(makeProps())
      );

      expect(
        evolution.update({
          goalUpdates: [{ goalId: Uuid.random().value, status: GoalStatus.ACHIEVED }],
        })
      ).toEqual({ ok: false, error: "INVALID_PLAN" });
    });
  });
});

describe("computeGoalChanges", () => {
  it("should ignore goals already in the requested status", () => {
    const plan = makePlan();

    const changes = computeGoalChanges(plan, [
      { goalId: plan.goals[0].id.value, status: GoalStatus.NOT_STARTED },
    ]);

    expect(changes).toEqual([]);
  });

  it("should return only the goals whose status differs from the plan", () => {
    const plan = makePlan();

    const changes = computeGoalChanges(plan, [
      { goalId: plan.goals[0].id.value, status: GoalStatus.NOT_STARTED },
      { goalId: plan.goals[1].id.value, status: GoalStatus.ACHIEVED },
    ]);

    expect(changes).toEqual([
      { goalId: plan.goals[1].id.value, status: GoalStatus.ACHIEVED },
    ]);
  });

  it("should compare with the current plan status, so reapplying is idempotent", () => {
    const plan = makePlan();
    const goalId = plan.goals[1].id.value;
    const achieved = unwrap<Plan>(plan.changeGoalStatus(goalId, GoalStatus.ACHIEVED));

    expect(
      computeGoalChanges(achieved, [{ goalId, status: GoalStatus.ACHIEVED }])
    ).toEqual([]);
    expect(
      computeGoalChanges(achieved, [{ goalId, status: GoalStatus.IN_PROGRESS }])
    ).toEqual([{ goalId, status: GoalStatus.IN_PROGRESS }]);
  });

  it("should still report differences on a closed plan", () => {
    const plan = makePlan();
    const closed = unwrap<Plan>(plan.close(PlanStatus.COMPLETED));

    expect(
      computeGoalChanges(closed, [
        { goalId: plan.goals[0].id.value, status: GoalStatus.ACHIEVED },
      ])
    ).toHaveLength(1);
  });
});
