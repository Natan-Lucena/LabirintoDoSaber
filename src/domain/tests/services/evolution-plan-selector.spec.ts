import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { selectEvolutionPlan } from "../../services/evolution-plan-selector";
import {
  CreatePlanProps,
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
const appointmentId = Uuid.random();

// 23:30 de 10/11 em São Paulo; em UTC já é 11/11.
const STARTED_AT = new Date("2026-11-11T02:30:00.000Z");

const makeSession = (sessionAppointmentId?: Uuid) =>
  new TaskNotebookSession(
    Uuid.random(),
    studentId,
    educatorId,
    "Sessão",
    STARTED_AT,
    new Date("2026-11-11T03:15:00.000Z"),
    [],
    undefined,
    undefined,
    sessionAppointmentId
  );

const makePlan = (overrides: Partial<CreatePlanProps>) =>
  unwrap<Plan>(
    Plan.create({
      educatorId,
      studentId,
      type: PlanType.PDI,
      source: PlanSource.MANUAL,
      title: "Plano",
      generalObjective: "Objetivo",
      startDate: "2026-11-01",
      endDate: "2027-05-01",
      goals: [{ description: "Meta A" }, { description: "Meta B" }],
      ...overrides,
    })
  );

const makePe = (overrides: Partial<CreatePlanProps>) =>
  makePlan({
    type: PlanType.PE,
    startDate: undefined,
    endDate: undefined,
    sessionDate: "2026-11-01",
    ...overrides,
  });

describe("selectEvolutionPlan", () => {
  it("should prefer the PE of the session appointment", () => {
    const peByAppointment = makePe({ title: "PE do atendimento", appointmentId });
    const peByDate = makePe({ title: "PE do dia", sessionDate: "2026-11-10" });
    const pdi = makePlan({ title: "PDI" });

    const selection = selectEvolutionPlan({
      session: makeSession(appointmentId),
      plans: [pdi, peByDate, peByAppointment],
    });

    expect(selection?.plan.id.value).toBe(peByAppointment.id.value);
  });

  it("should use the PE of the session date (São Paulo) when no PE matches the appointment", () => {
    const peOtherAppointment = makePe({ appointmentId: Uuid.random() });
    const peUtcDate = makePe({ title: "PE do dia em UTC", sessionDate: "2026-11-11" });
    const peByDate = makePe({ title: "PE do dia", sessionDate: "2026-11-10" });
    const pdi = makePlan({ title: "PDI" });

    const selection = selectEvolutionPlan({
      session: makeSession(appointmentId),
      plans: [pdi, peOtherAppointment, peUtcDate, peByDate],
    });

    expect(selection?.plan.id.value).toBe(peByDate.id.value);
  });

  it("should fall back to the active PDI when no PE matches", () => {
    const peOtherDay = makePe({ sessionDate: "2026-11-09" });
    const pdi = makePlan({ title: "PDI" });

    const selection = selectEvolutionPlan({
      session: makeSession(),
      plans: [peOtherDay, pdi],
    });

    expect(selection?.plan.id.value).toBe(pdi.id.value);
  });

  it("should return undefined when no plan matches", () => {
    expect(selectEvolutionPlan({ session: makeSession(), plans: [] })).toBeUndefined();
    expect(
      selectEvolutionPlan({
        session: makeSession(),
        plans: [makePe({ sessionDate: "2026-11-09" })],
      })
    ).toBeUndefined();
  });

  it("should ignore plans that are not ACTIVE", () => {
    const pdi = makePlan({});
    const closed = unwrap<Plan>(pdi.close(PlanStatus.COMPLETED));

    expect(
      selectEvolutionPlan({ session: makeSession(), plans: [closed] })
    ).toBeUndefined();
  });

  it("should suggest the plan goals in order, without ACHIEVED and DISCONTINUED", () => {
    let pdi = makePlan({
      goals: [
        { description: "Meta 1" },
        { description: "Meta 2", successCriterion: "8 de 10" },
        { description: "Meta 3" },
        { description: "Meta 4" },
      ],
    });
    pdi = unwrap<Plan>(pdi.changeGoalStatus(pdi.goals[0].id.value, GoalStatus.ACHIEVED));
    pdi = unwrap<Plan>(pdi.changeGoalStatus(pdi.goals[2].id.value, GoalStatus.DISCONTINUED));
    pdi = unwrap<Plan>(pdi.changeGoalStatus(pdi.goals[3].id.value, GoalStatus.IN_PROGRESS));

    const selection = selectEvolutionPlan({ session: makeSession(), plans: [pdi] });

    expect(selection?.suggestedCriteria).toEqual([
      {
        goalId: pdi.goals[1].id.value,
        description: "Meta 2",
        successCriterion: "8 de 10",
        goalStatus: GoalStatus.NOT_STARTED,
      },
      {
        goalId: pdi.goals[3].id.value,
        description: "Meta 4",
        successCriterion: undefined,
        goalStatus: GoalStatus.IN_PROGRESS,
      },
    ]);
  });
});
