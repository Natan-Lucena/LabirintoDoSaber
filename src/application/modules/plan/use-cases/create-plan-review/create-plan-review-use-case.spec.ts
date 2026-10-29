import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { CreatePlanReviewUseCase } from "./create-plan-review-use-case";
import { Plan, PlanSource, PlanType } from "../../../../../domain/entities/plan";
import { PlanReview } from "../../../../../domain/entities/plan-review";
import { Gender, Student } from "../../../../../domain/entities/student";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { PlanReviewRepository } from "../../../../../domain/repositories/plan-review-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";

describe("CreatePlanReviewUseCase", () => {
  let planRepository: PlanRepository;
  let planReviewRepository: PlanReviewRepository;
  let studentRepository: StudentRepository;
  let useCase: CreatePlanReviewUseCase;
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
      nextReviewDate: "2026-03-01",
      goals: [{ description: "Meta" }],
    });
    if (!created.ok) throw new Error(created.error);
    plan = created.value;

    planRepository = {
      findById: vi.fn().mockResolvedValue(plan),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as PlanRepository;
    planReviewRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      listByPlanId: vi.fn(),
    } as unknown as PlanReviewRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    useCase = new CreatePlanReviewUseCase(planRepository, planReviewRepository, studentRepository);
  });

  it("should save the review and update the plan nextReviewDate", async () => {
    const result = await useCase.execute({
      educatorId,
      planId: plan.id.value,
      note: "Evoluiu bem",
      nextReviewDate: "2026-04-15",
    });

    expect(result.ok).toBe(true);
    const review = (result as any).value as PlanReview;
    expect(review.note).toBe("Evoluiu bem");
    expect(review.planId.value).toBe(plan.id.value);
    expect(review.goalStatuses).toHaveLength(1);
    expect(planReviewRepository.save).toHaveBeenCalledWith(review);

    const savedPlan = (planRepository.save as any).mock.calls[0][0] as Plan;
    expect(savedPlan.nextReviewDate).toBe("2026-04-15");
  });

  it("should return INVALID_DATES when nextReviewDate is outside the plan period", async () => {
    const result = await useCase.execute({
      educatorId,
      planId: plan.id.value,
      note: "Nota",
      nextReviewDate: "2026-12-01",
    });

    expect(result).toEqual({ ok: false, error: "INVALID_DATES" });
    expect(planRepository.save).not.toHaveBeenCalled();
    expect(planReviewRepository.save).not.toHaveBeenCalled();
  });
});
