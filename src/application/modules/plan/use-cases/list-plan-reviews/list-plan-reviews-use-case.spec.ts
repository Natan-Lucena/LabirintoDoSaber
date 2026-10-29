import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListPlanReviewsUseCase } from "./list-plan-reviews-use-case";
import { Plan, PlanSource, PlanType } from "../../../../../domain/entities/plan";
import { Gender, Student } from "../../../../../domain/entities/student";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { PlanReviewRepository } from "../../../../../domain/repositories/plan-review-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";

describe("ListPlanReviewsUseCase", () => {
  let planRepository: PlanRepository;
  let planReviewRepository: PlanReviewRepository;
  let studentRepository: StudentRepository;
  let useCase: ListPlanReviewsUseCase;
  let plan: Plan;

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
    plan = created.value;

    planRepository = {
      findById: vi.fn().mockResolvedValue(plan),
    } as unknown as PlanRepository;
    planReviewRepository = {
      save: vi.fn(),
      listByPlanId: vi.fn(),
    } as unknown as PlanReviewRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    useCase = new ListPlanReviewsUseCase(planRepository, planReviewRepository, studentRepository);
  });

  it("should return the reviews of the plan", async () => {
    const reviewed = plan.review("Evoluiu bem");
    if (!reviewed.ok) throw new Error(reviewed.error);
    (planReviewRepository.listByPlanId as any).mockResolvedValue([reviewed.value.review]);

    const result = await useCase.execute({ educatorId, planId: plan.id.value });

    expect(result).toEqual({ ok: true, value: [reviewed.value.review] });
    expect(planReviewRepository.listByPlanId).toHaveBeenCalledWith(plan.id);
  });

  it("should return PLAN_NOT_FOUND when the plan does not exist", async () => {
    (planRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({ educatorId, planId: Uuid.random().value });

    expect(result).toEqual({ ok: false, error: "PLAN_NOT_FOUND" });
    expect(planReviewRepository.listByPlanId).not.toHaveBeenCalled();
  });

  it("should return UNAUTHORIZED when the plan belongs to another educator", async () => {
    const result = await useCase.execute({ educatorId: Uuid.random(), planId: plan.id.value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(planReviewRepository.listByPlanId).not.toHaveBeenCalled();
  });
});
