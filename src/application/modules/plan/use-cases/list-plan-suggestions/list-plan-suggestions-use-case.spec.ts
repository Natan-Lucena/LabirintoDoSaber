import { describe, it, expect, vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListPlanSuggestionsUseCase } from "./list-plan-suggestions-use-case";
import { Plan, PlanSource, PlanType } from "../../../../../domain/entities/plan";
import {
  PlanSuggestion,
  SuggestionKind,
  SuggestionStatus,
} from "../../../../../domain/entities/plan-suggestion";
import { Gender, Student } from "../../../../../domain/entities/student";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";

const makeStudent = (name: string, educatorId: Uuid) =>
  Student.create({
    name,
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

const makeSuggestion = (educatorId: Uuid, studentId: Uuid) => {
  const plan = Plan.create({
    educatorId,
    studentId,
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
  return created.value;
};

describe("ListPlanSuggestionsUseCase", () => {
  it("lists the educator suggestions with the student name, filtering by status", async () => {
    const educatorId = Uuid.random();
    const ana = makeStudent("Ana", educatorId);
    const transferred = makeStudent("Bia", Uuid.random());
    const first = makeSuggestion(educatorId, ana.id);
    const second = makeSuggestion(educatorId, transferred.id);

    const suggestionRepository = {
      listByEducatorId: vi.fn().mockResolvedValue([first, second]),
    } as unknown as PlanSuggestionRepository;
    const studentRepository = {
      getByIds: vi.fn().mockResolvedValue([ana, transferred]),
    } as unknown as StudentRepository;
    const useCase = new ListPlanSuggestionsUseCase(suggestionRepository, studentRepository);

    const result = await useCase.execute({ educatorId, status: SuggestionStatus.PENDING });

    expect(suggestionRepository.listByEducatorId).toHaveBeenCalledWith(
      educatorId,
      SuggestionStatus.PENDING
    );
    expect(studentRepository.getByIds).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({ id: first.id.value, studentName: "Ana" });
  });
});
