import { describe, it, expect, vi, beforeEach } from "vitest";
import { success, Uuid } from "@wave-telecom/framework/core";
import { GeneratePlanSuggestionsUseCase } from "./generate-plan-suggestions-use-case";
import { Plan, PlanSource, PlanStatus, PlanType } from "../../../../../domain/entities/plan";
import {
  PlanSuggestion,
  SuggestionKind,
  SuggestionStatus,
} from "../../../../../domain/entities/plan-suggestion";
import { Gender, Student } from "../../../../../domain/entities/student";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import {
  AiInvalidOutputError,
  AiPlanGeneratorService,
  PlanSuggestionOutput,
} from "../../../../../domain/services/ai-plan-generator-service";
import { AnamneseContextBuilder } from "../../../../services/anamnese-context-builder";
import { GenerateStudentAnalysisUseCase } from "../../../task-notebook-session/use-cases/generate-student-analisys/generate-student-analisys-use-case";

const STUDENT_NAME = "Mariazinha Fixture da Silva";

describe("GeneratePlanSuggestionsUseCase", () => {
  const educatorId = Uuid.random();
  const student = Student.create({
    name: STUDENT_NAME,
    age: 9,
    gender: Gender.Female,
    zipcode: "01310100",
    road: "Avenida Paulista Fixture",
    housenumber: "1578",
    phonenumber: "11987654321",
    learningTopics: [],
    educators: [],
    educatorId,
  });

  let plan: Plan;
  let saved: PlanSuggestion[];
  let planRepository: PlanRepository;
  let studentRepository: StudentRepository;
  let suggestionRepository: PlanSuggestionRepository;
  let aiService: AiPlanGeneratorService;
  let useCase: GeneratePlanSuggestionsUseCase;

  const goalId = () => plan.goals[0].id.value;

  const statusSuggestion = (id = goalId()): PlanSuggestionOutput => ({
    kind: SuggestionKind.UPDATE_GOAL_STATUS,
    goalId: id,
    text: "A meta vem sendo trabalhada nas últimas sessões.",
    proposedChange: { status: "IN_PROGRESS" },
  });

  const addSuggestion = (n: number): PlanSuggestionOutput => ({
    kind: SuggestionKind.ADD_GOAL,
    text: `Incluir meta ${n}`,
    proposedChange: { description: `Meta nova ${n}`, successCriterion: "8 de 10" },
  });

  const execute = () => useCase.execute({ educatorId, planId: plan.id.value });

  const pendingOf = (n: number) => {
    for (let i = 0; i < n; i++) {
      const created = PlanSuggestion.create(plan, addSuggestion(i));
      if (!created.ok) throw new Error(created.error);
      saved.push(created.value);
    }
  };

  beforeEach(() => {
    const created = Plan.create({
      educatorId,
      studentId: student.id,
      type: PlanType.PDI,
      source: PlanSource.MANUAL,
      title: "PDI",
      generalObjective: "Desenvolver a leitura",
      focus: "Leitura",
      consideredDifficulties: ["troca de letras"],
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      goals: [{ description: "Ler sílabas simples" }, { description: "Escrever o nome" }],
    });
    if (!created.ok) throw new Error(created.error);
    plan = created.value;
    saved = [];

    planRepository = {
      findById: vi.fn(async () => plan),
    } as unknown as PlanRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    suggestionRepository = {
      countPendingByPlanId: vi.fn(
        async () => saved.filter((s) => s.status === SuggestionStatus.PENDING).length
      ),
      save: vi.fn(async (suggestion: PlanSuggestion) => {
        saved.push(suggestion);
      }),
    } as unknown as PlanSuggestionRepository;
    aiService = {
      generateSuggestions: vi
        .fn()
        .mockResolvedValue([statusSuggestion(), addSuggestion(1), addSuggestion(2)]),
    } as unknown as AiPlanGeneratorService;

    const analysisUseCase = {
      loadAnalysisData: vi.fn().mockResolvedValue(
        success({
          sessions: [],
          categories: {},
          total: { total: 0, correct: 0, accuracy: 0 },
        })
      ),
    } as unknown as GenerateStudentAnalysisUseCase;

    useCase = new GeneratePlanSuggestionsUseCase(
      planRepository,
      studentRepository,
      suggestionRepository,
      new AnamneseContextBuilder(
        {} as AnamneseTemplateRepository,
        {} as AnamneseResponseRepository
      ),
      analysisUseCase,
      aiService
    );
  });

  it("saves and returns the valid suggestions as PENDING", async () => {
    const result = await execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
    expect(result.value[0]).toMatchObject({
      planId: plan.id.value,
      studentId: student.id.value,
      studentName: STUDENT_NAME,
      goalId: goalId(),
      kind: SuggestionKind.UPDATE_GOAL_STATUS,
      status: SuggestionStatus.PENDING,
      proposedChange: { status: "IN_PROGRESS" },
    });
    expect(saved).toHaveLength(3);
  });

  it("sends the real goal ids and no identifiable data to the AI", async () => {
    await execute();

    const params = (aiService.generateSuggestions as any).mock.calls[0][0];
    expect(params.max).toBe(3);
    expect(params.plan.goals.map((g: any) => g.id)).toEqual(
      plan.goals.map((g) => g.id.value)
    );
    expect(params.context.student).toEqual({ age: 9, gender: Gender.Female });
    const serialized = JSON.stringify(params);
    expect(serialized).not.toContain(STUDENT_NAME);
    expect(serialized).not.toContain("11987654321");
    expect(serialized).not.toContain("Paulista");
  });

  it("generates at most 1 when there are 2 pending", async () => {
    pendingOf(2);

    const result = await execute();

    expect((aiService.generateSuggestions as any).mock.calls[0][0].max).toBe(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(saved).toHaveLength(3);
  });

  it("returns [] without calling the AI when there are 3 pending", async () => {
    pendingOf(3);

    const result = await execute();

    expect(result).toEqual({ ok: true, value: [] });
    expect(aiService.generateSuggestions).not.toHaveBeenCalled();
    expect(saved).toHaveLength(3);
  });

  it("never leaves more than 3 pending when asked twice", async () => {
    await execute();
    const second = await execute();

    expect(second).toEqual({ ok: true, value: [] });
    expect(saved.filter((s) => s.isPending)).toHaveLength(3);
  });

  it("dismisses the excess it created when a concurrent call passed the limit", async () => {
    // 0 pendentes antes; depois de salvar, outra chamada já tinha gravado 1.
    (suggestionRepository.countPendingByPlanId as any)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(4);

    const result = await execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(saved).toHaveLength(4);
    const dismissed = saved[3];
    expect(dismissed.status).toBe(SuggestionStatus.DISMISSED);
    expect(dismissed.resolvedAt).toBeInstanceOf(Date);
    expect(dismissed.id.value).toBe(saved[2].id.value);
    expect(result.value.map((s) => s.id)).not.toContain(dismissed.id.value);
  });

  it("dismisses at most what this call created", async () => {
    (suggestionRepository.countPendingByPlanId as any)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(7);

    const result = await execute();

    expect(result).toEqual({ ok: true, value: [] });
    expect(saved.slice(3).map((s) => s.status)).toEqual([
      SuggestionStatus.DISMISSED,
      SuggestionStatus.DISMISSED,
      SuggestionStatus.DISMISSED,
    ]);
  });

  it("discards a suggestion with an invented goalId", async () => {
    (aiService.generateSuggestions as any).mockResolvedValue([
      statusSuggestion(Uuid.random().value),
      addSuggestion(1),
    ]);

    const result = await execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].kind).toBe(SuggestionKind.ADD_GOAL);
  });

  it("discards incoherent changes, long texts and review dates outside the plan", async () => {
    (aiService.generateSuggestions as any).mockResolvedValue([
      { kind: "UNKNOWN", text: "x", proposedChange: {} },
      { ...statusSuggestion(), proposedChange: { description: "sem status" } },
      { ...addSuggestion(1), text: "t".repeat(501) },
      {
        kind: SuggestionKind.SCHEDULE_REVIEW,
        text: "Revisar depois do fim",
        proposedChange: { nextReviewDate: "2026-07-15" },
      },
      {
        kind: SuggestionKind.SCHEDULE_REVIEW,
        text: "Revisar no mês que vem",
        proposedChange: { nextReviewDate: "2026-02-15" },
      },
    ]);

    const result = await execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0].proposedChange).toEqual({ nextReviewDate: "2026-02-15" });
  });

  it("returns PLAN_NOT_EDITABLE for a closed plan", async () => {
    const closed = plan.close(PlanStatus.COMPLETED);
    if (!closed.ok) throw new Error(closed.error);
    plan = closed.value;

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "PLAN_NOT_EDITABLE" });
    expect(aiService.generateSuggestions).not.toHaveBeenCalled();
  });

  it("returns UNAUTHORIZED for a plan of another educator", async () => {
    const result = await useCase.execute({ educatorId: Uuid.random(), planId: plan.id.value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("returns AI_INVALID_OUTPUT when the service throws AiInvalidOutputError", async () => {
    (aiService.generateSuggestions as any).mockRejectedValue(new AiInvalidOutputError());

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });
    expect(saved).toHaveLength(0);
  });

  it("returns AI_GENERATION_FAILED without logging the provider message", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    (aiService.generateSuggestions as any).mockRejectedValue(
      Object.assign(new Error("503 overloaded"), { status: 503 })
    );

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "AI_GENERATION_FAILED" });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("overloaded");
    consoleError.mockRestore();
  });
});
