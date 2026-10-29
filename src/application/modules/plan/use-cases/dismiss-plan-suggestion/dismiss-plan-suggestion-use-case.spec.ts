import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { DismissPlanSuggestionUseCase } from "./dismiss-plan-suggestion-use-case";
import { Plan, PlanSource, PlanType } from "../../../../../domain/entities/plan";
import {
  PlanSuggestion,
  SuggestionKind,
  SuggestionStatus,
} from "../../../../../domain/entities/plan-suggestion";
import { Gender, Student } from "../../../../../domain/entities/student";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";

describe("DismissPlanSuggestionUseCase", () => {
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

  let suggestion: PlanSuggestion;
  let suggestionRepository: PlanSuggestionRepository;
  let studentRepository: StudentRepository;
  let useCase: DismissPlanSuggestionUseCase;

  beforeEach(() => {
    const plan = Plan.create({
      educatorId,
      studentId: student.id,
      type: PlanType.PDI,
      source: PlanSource.MANUAL,
      title: "PDI",
      generalObjective: "Objetivo",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      goals: [{ description: "Meta" }],
    });
    if (!plan.ok) throw new Error(plan.error);
    const created = PlanSuggestion.create(plan.value, {
      kind: SuggestionKind.ADD_GOAL,
      text: "Incluir meta.",
      proposedChange: { description: "Nova meta" },
    });
    if (!created.ok) throw new Error(created.error);
    suggestion = created.value;

    suggestionRepository = {
      findById: vi.fn(async () => suggestion),
      save: vi.fn(async (saved: PlanSuggestion) => {
        suggestion = saved;
      }),
    } as unknown as PlanSuggestionRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;

    useCase = new DismissPlanSuggestionUseCase(suggestionRepository, studentRepository);
  });

  it("dismisses the suggestion", async () => {
    const result = await useCase.execute({ educatorId, suggestionId: suggestion.id.value });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: suggestion.id.value,
      status: SuggestionStatus.DISMISSED,
      studentName: "Ana",
    });
    expect(result.value.resolvedAt).toBeInstanceOf(Date);
    expect(suggestion.status).toBe(SuggestionStatus.DISMISSED);
  });

  it("returns SUGGESTION_ALREADY_RESOLVED when dismissing twice", async () => {
    await useCase.execute({ educatorId, suggestionId: suggestion.id.value });

    const result = await useCase.execute({ educatorId, suggestionId: suggestion.id.value });

    expect(result).toEqual({ ok: false, error: "SUGGESTION_ALREADY_RESOLVED" });
    expect(suggestionRepository.save).toHaveBeenCalledOnce();
  });

  it("returns UNAUTHORIZED for a suggestion of another educator", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      suggestionId: suggestion.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("returns UNAUTHORIZED when the student moved to another educator", async () => {
    const transferred = Student.create({
      name: "Ana",
      age: 8,
      gender: Gender.Female,
      zipcode: "00000000",
      road: "Rua",
      housenumber: "1",
      phonenumber: "11999999999",
      learningTopics: [],
      educators: [],
      educatorId: Uuid.random(),
    });
    (studentRepository.getById as any).mockResolvedValue(transferred);

    const result = await useCase.execute({ educatorId, suggestionId: suggestion.id.value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(suggestionRepository.save).not.toHaveBeenCalled();
    expect(suggestion.status).toBe(SuggestionStatus.PENDING);
  });

  it("returns SUGGESTION_NOT_FOUND", async () => {
    (suggestionRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({ educatorId, suggestionId: Uuid.random().value });

    expect(result).toEqual({ ok: false, error: "SUGGESTION_NOT_FOUND" });
  });
});
