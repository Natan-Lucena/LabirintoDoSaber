import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ClosePlanUseCase } from "./close-plan-use-case";
import { Plan, PlanSource, PlanStatus, PlanType } from "../../../../../domain/entities/plan";
import { Gender, Student } from "../../../../../domain/entities/student";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";

describe("ClosePlanUseCase", () => {
  let planRepository: PlanRepository;
  let studentRepository: StudentRepository;
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let suggestionRepository: PlanSuggestionRepository;
  let useCase: ClosePlanUseCase;

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

  let stored: Plan;

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
      goals: [{ description: "Meta" }],
    });
    if (!created.ok) throw new Error(created.error);
    stored = created.value;

    planRepository = {
      findById: vi.fn(async () => stored),
      save: vi.fn(async (plan: Plan) => {
        stored = plan;
      }),
    } as unknown as PlanRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    suggestionRepository = {
      dismissPendingByPlanId: vi.fn(),
    } as unknown as PlanSuggestionRepository;
    shareRepository = makeShareRepository();
    useCase = new ClosePlanUseCase(planRepository, makeStudentAccess(studentRepository, shareRepository), suggestionRepository);
  });

  it("should close the plan with the given status", async () => {
    const result = await useCase.execute({
      educatorId,
      planId: stored.id.value,
      status: PlanStatus.CANCELLED,
    });

    expect(result.ok).toBe(true);
    expect(stored.status).toBe(PlanStatus.CANCELLED);
    expect(stored.closedAt).toBeInstanceOf(Date);
  });

  it("should dismiss the pending suggestions of the closed plan", async () => {
    const planId = stored.id.value;

    await useCase.execute({ educatorId, planId, status: PlanStatus.COMPLETED });

    expect(suggestionRepository.dismissPendingByPlanId).toHaveBeenCalledOnce();
    expect((suggestionRepository.dismissPendingByPlanId as any).mock.calls[0][0].value).toBe(planId);
  });

  it("should return PLAN_NOT_EDITABLE when closing twice", async () => {
    const planId = stored.id.value;
    await useCase.execute({ educatorId, planId, status: PlanStatus.COMPLETED });

    const result = await useCase.execute({ educatorId, planId, status: PlanStatus.CANCELLED });

    expect(result).toEqual({ ok: false, error: "PLAN_NOT_EDITABLE" });
    expect(stored.status).toBe(PlanStatus.COMPLETED);
    expect(planRepository.save).toHaveBeenCalledOnce();
    expect(suggestionRepository.dismissPendingByPlanId).toHaveBeenCalledOnce();
  });

  it("should let a colleague the student is shared with close the owner plan", async () => {
    // Plano criado pelo dono; o colega com quem o aluno foi compartilhado
    // escreve nele como o dono (EQ-11).
    const colleagueId = Uuid.random();
    await shareRepository.create(shareStudent(student, colleagueId));

    const result = await useCase.execute({
      educatorId: colleagueId,
      planId: stored.id.value,
      status: PlanStatus.COMPLETED,
    });

    expect(result.ok).toBe(true);
    expect(((result as any).value as Plan).status).toBe(PlanStatus.COMPLETED);
  });

  it("should return UNAUTHORIZED to a colleague after the share is undone", async () => {
    const colleagueId = Uuid.random();
    await shareRepository.create(shareStudent(student, colleagueId));
    await shareRepository.delete(student.id, colleagueId);

    const result = await useCase.execute({
      educatorId: colleagueId,
      planId: stored.id.value,
      status: PlanStatus.COMPLETED,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });
});
