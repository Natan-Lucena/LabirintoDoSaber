import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ChangeGoalStatusUseCase } from "./change-goal-status-use-case";
import {
  GoalStatus,
  Plan,
  PlanSource,
  PlanStatus,
  PlanType,
} from "../../../../../domain/entities/plan";
import { Gender, Student } from "../../../../../domain/entities/student";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";

const makeStudent = (educatorId: Uuid) =>
  Student.create({
    name: "Ana",
    age: 8,
    gender: Gender.Female,
    zipcode: "00000000",
    road: "Rua",
    housenumber: "1",
    phonenumber: "11999999999",
    learningTopics: [],
    educators: [],
    educatorId,
  });

describe("ChangeGoalStatusUseCase", () => {
  let planRepository: PlanRepository;
  let studentRepository: StudentRepository;
  let useCase: ChangeGoalStatusUseCase;
  let plan: Plan;

  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  beforeEach(() => {
    vi.restoreAllMocks();
    const created = Plan.create({
      educatorId,
      studentId: student.id,
      type: PlanType.PDI,
      source: PlanSource.MANUAL,
      title: "PDI",
      generalObjective: "Objetivo",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      goals: [{ description: "Meta 1" }, { description: "Meta 2" }],
    });
    if (!created.ok) throw new Error(created.error);
    plan = created.value;

    planRepository = {
      findById: vi.fn().mockResolvedValue(plan),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as PlanRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    useCase = new ChangeGoalStatusUseCase(planRepository, studentRepository);
  });

  it("should change the goal status, recalculate progress and save", async () => {
    const goalId = plan.goals[0].id.value;

    const result = await useCase.execute({
      educatorId,
      planId: plan.id.value,
      goalId,
      status: GoalStatus.ACHIEVED,
    });

    expect(result.ok).toBe(true);
    const updated = (result as any).value as Plan;
    const goal = updated.goals.find((g) => g.id.value === goalId)!;
    expect(goal.status).toBe(GoalStatus.ACHIEVED);
    expect(goal.achievedAt).toBeInstanceOf(Date);
    expect(updated.progress).toEqual({
      totalGoals: 2,
      achievedGoals: 1,
      inProgressGoals: 0,
      percent: 50,
    });
    expect(planRepository.save).toHaveBeenCalledWith(updated);
  });

  it("should return GOAL_NOT_FOUND when the goal is not in the plan", async () => {
    const result = await useCase.execute({
      educatorId,
      planId: plan.id.value,
      goalId: Uuid.random().value,
      status: GoalStatus.IN_PROGRESS,
    });

    expect(result).toEqual({ ok: false, error: "GOAL_NOT_FOUND" });
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("should return PLAN_NOT_EDITABLE when the plan is closed", async () => {
    const closed = plan.close(PlanStatus.CANCELLED);
    if (!closed.ok) throw new Error(closed.error);
    (planRepository.findById as any).mockResolvedValue(closed.value);

    const result = await useCase.execute({
      educatorId,
      planId: plan.id.value,
      goalId: plan.goals[0].id.value,
      status: GoalStatus.IN_PROGRESS,
    });

    expect(result).toEqual({ ok: false, error: "PLAN_NOT_EDITABLE" });
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("should return UNAUTHORIZED when the plan belongs to another educator", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      planId: plan.id.value,
      goalId: plan.goals[0].id.value,
      status: GoalStatus.IN_PROGRESS,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(planRepository.save).not.toHaveBeenCalled();
  });
});
