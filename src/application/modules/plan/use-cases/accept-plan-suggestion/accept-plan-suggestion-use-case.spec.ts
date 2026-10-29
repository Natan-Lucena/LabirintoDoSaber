import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { AcceptPlanSuggestionUseCase } from "./accept-plan-suggestion-use-case";
import {
  GoalStatus,
  MAX_PLAN_GOALS,
  Plan,
  PlanSource,
  PlanStatus,
  PlanType,
} from "../../../../../domain/entities/plan";
import {
  CreatePlanSuggestionProps,
  PlanSuggestion,
  SuggestionKind,
  SuggestionStatus,
} from "../../../../../domain/entities/plan-suggestion";
import { Gender, Student } from "../../../../../domain/entities/student";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";

describe("AcceptPlanSuggestionUseCase", () => {
  const educatorId = Uuid.random();
  const student = Student.create({
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

  let plan: Plan;
  let suggestion: PlanSuggestion;
  let planRepository: PlanRepository;
  let suggestionRepository: PlanSuggestionRepository;
  let useCase: AcceptPlanSuggestionUseCase;

  const suggest = (input: CreatePlanSuggestionProps) => {
    const created = PlanSuggestion.create(plan, input);
    if (!created.ok) throw new Error(created.error);
    suggestion = created.value;
  };

  const execute = (id = suggestion.id.value) =>
    useCase.execute({ educatorId, suggestionId: id });

  beforeEach(() => {
    const created = Plan.create({
      educatorId,
      studentId: student.id,
      type: PlanType.PDI,
      source: PlanSource.MANUAL,
      title: "PDI",
      generalObjective: "Objetivo",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      goals: [
        { description: "Ler sílabas", successCriterion: "8 de 10" },
        { description: "Escrever o nome" },
      ],
    });
    if (!created.ok) throw new Error(created.error);
    plan = created.value;

    suggest({
      kind: SuggestionKind.UPDATE_GOAL_STATUS,
      goalId: plan.goals[0].id.value,
      text: "A meta foi atingida nas últimas sessões.",
      proposedChange: { status: GoalStatus.ACHIEVED },
    });

    planRepository = {
      findById: vi.fn(async () => plan),
      save: vi.fn(async (saved: Plan) => {
        plan = saved;
      }),
    } as unknown as PlanRepository;
    const studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    suggestionRepository = {
      findById: vi.fn(async () => suggestion),
      save: vi.fn(async (saved: PlanSuggestion) => {
        suggestion = saved;
      }),
    } as unknown as PlanSuggestionRepository;

    useCase = new AcceptPlanSuggestionUseCase(
      planRepository,
      studentRepository,
      suggestionRepository
    );
  });

  it("applies UPDATE_GOAL_STATUS, updating the goal and the progress", async () => {
    const result = await execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.goals[0].status).toBe(GoalStatus.ACHIEVED);
    expect(result.value.progress.percent).toBe(50);
    expect(plan.goals[0].status).toBe(GoalStatus.ACHIEVED);
    expect(suggestion.status).toBe(SuggestionStatus.ACCEPTED);
    expect(suggestion.resolvedAt).toBeInstanceOf(Date);
  });

  it("saves the plan before the suggestion", async () => {
    await execute();

    const planOrder = (planRepository.save as any).mock.invocationCallOrder[0];
    const suggestionOrder = (suggestionRepository.save as any).mock.invocationCallOrder[0];
    expect(planOrder).toBeLessThan(suggestionOrder);
  });

  it("applies ADD_GOAL", async () => {
    suggest({
      kind: SuggestionKind.ADD_GOAL,
      text: "Incluir meta de rimas.",
      proposedChange: { description: "Identificar rimas", successCriterion: "4 de 5" },
    });

    const result = await execute();

    expect(result.ok).toBe(true);
    expect(plan.goals).toHaveLength(3);
    expect(plan.goals[2]).toMatchObject({
      description: "Identificar rimas",
      successCriterion: "4 de 5",
      status: GoalStatus.NOT_STARTED,
    });
  });

  it("applies REWRITE_GOAL keeping the other goals", async () => {
    const [first, second] = plan.goals;
    suggest({
      kind: SuggestionKind.REWRITE_GOAL,
      goalId: second.id.value,
      text: "Deixar a meta mais mensurável.",
      proposedChange: { description: "Escrever o nome sem modelo" },
    });

    const result = await execute();

    expect(result.ok).toBe(true);
    expect(plan.goals).toHaveLength(2);
    expect(plan.goals[0]).toMatchObject({ id: first.id, description: "Ler sílabas" });
    expect(plan.goals[1]).toMatchObject({
      id: second.id,
      description: "Escrever o nome sem modelo",
    });
  });

  it("applies SCHEDULE_REVIEW", async () => {
    suggest({
      kind: SuggestionKind.SCHEDULE_REVIEW,
      text: "Revisar em fevereiro.",
      proposedChange: { nextReviewDate: "2026-02-15" },
    });

    const result = await execute();

    expect(result.ok).toBe(true);
    expect(plan.nextReviewDate).toBe("2026-02-15");
  });

  it("returns SUGGESTION_NOT_APPLICABLE and dismisses when the goal was removed", async () => {
    const updated = plan.update({
      goals: [{ id: plan.goals[1].id.value, description: "Escrever o nome" }],
    });
    if (!updated.ok) throw new Error(updated.error);
    plan = updated.value;

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "SUGGESTION_NOT_APPLICABLE" });
    expect(suggestion.status).toBe(SuggestionStatus.DISMISSED);
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("returns SUGGESTION_NOT_APPLICABLE when REWRITE_GOAL points to a removed goal", async () => {
    suggest({
      kind: SuggestionKind.REWRITE_GOAL,
      goalId: plan.goals[0].id.value,
      text: "Reescrever.",
      proposedChange: { description: "Nova descrição" },
    });
    const updated = plan.update({
      goals: [{ id: plan.goals[1].id.value, description: "Escrever o nome" }],
    });
    if (!updated.ok) throw new Error(updated.error);
    plan = updated.value;

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "SUGGESTION_NOT_APPLICABLE" });
    expect(suggestion.status).toBe(SuggestionStatus.DISMISSED);
  });

  it("returns SUGGESTION_NOT_APPLICABLE when the plan is closed", async () => {
    const closed = plan.close(PlanStatus.COMPLETED);
    if (!closed.ok) throw new Error(closed.error);
    plan = closed.value;

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "SUGGESTION_NOT_APPLICABLE" });
    expect(suggestion.status).toBe(SuggestionStatus.DISMISSED);
  });

  it("returns SUGGESTION_NOT_APPLICABLE when ADD_GOAL exceeds the goal limit", async () => {
    suggest({
      kind: SuggestionKind.ADD_GOAL,
      text: "Incluir meta.",
      proposedChange: { description: "Mais uma" },
    });
    const updated = plan.update({
      goals: Array.from({ length: MAX_PLAN_GOALS }, (_, i) => ({
        id: plan.goals[i]?.id.value,
        description: `Meta ${i}`,
      })),
    });
    if (!updated.ok) throw new Error(updated.error);
    plan = updated.value;

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "SUGGESTION_NOT_APPLICABLE" });
  });

  it("returns SUGGESTION_ALREADY_RESOLVED when accepting twice", async () => {
    await execute();

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "SUGGESTION_ALREADY_RESOLVED" });
    expect(planRepository.save).toHaveBeenCalledOnce();
  });

  it("returns SUGGESTION_NOT_FOUND", async () => {
    (suggestionRepository.findById as any).mockResolvedValue(null);

    expect(await execute(Uuid.random().value)).toEqual({
      ok: false,
      error: "SUGGESTION_NOT_FOUND",
    });
    expect(await execute("nao-e-uuid")).toEqual({
      ok: false,
      error: "SUGGESTION_NOT_FOUND",
    });
  });

  it("returns UNAUTHORIZED for a suggestion of another educator", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      suggestionId: suggestion.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(suggestion.status).toBe(SuggestionStatus.PENDING);
  });
});
