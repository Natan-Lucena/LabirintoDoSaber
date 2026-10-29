import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UpdatePlanUseCase } from "./update-plan-use-case";
import { Plan, PlanSource, PlanStatus, PlanType } from "../../../../../domain/entities/plan";
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

const makePlan = (educatorId: Uuid, studentId: Uuid) => {
  const result = Plan.create({
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
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe("UpdatePlanUseCase", () => {
  let planRepository: PlanRepository;
  let studentRepository: StudentRepository;
  let useCase: UpdatePlanUseCase;

  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  beforeEach(() => {
    vi.restoreAllMocks();
    planRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
    } as unknown as PlanRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    useCase = new UpdatePlanUseCase(planRepository, studentRepository);
  });

  it("should update and save the plan", async () => {
    const plan = makePlan(educatorId, student.id);
    (planRepository.findById as any).mockResolvedValue(plan);

    const result = await useCase.execute({
      educatorId,
      planId: plan.id.value,
      title: "Novo título",
    });

    expect(result.ok).toBe(true);
    expect(((result as any).value as Plan).title).toBe("Novo título");
    expect(planRepository.save).toHaveBeenCalledWith((result as any).value);
  });

  it("should return PLAN_NOT_EDITABLE when the plan is closed", async () => {
    const closed = makePlan(educatorId, student.id).close(PlanStatus.COMPLETED);
    if (!closed.ok) throw new Error(closed.error);
    (planRepository.findById as any).mockResolvedValue(closed.value);

    const result = await useCase.execute({
      educatorId,
      planId: closed.value.id.value,
      title: "Novo título",
    });

    expect(result).toEqual({ ok: false, error: "PLAN_NOT_EDITABLE" });
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("should return UNAUTHORIZED when the student now belongs to another educator", async () => {
    const plan = makePlan(educatorId, student.id);
    (planRepository.findById as any).mockResolvedValue(plan);
    (studentRepository.getById as any).mockResolvedValue(makeStudent(Uuid.random()));

    const result = await useCase.execute({ educatorId, planId: plan.id.value, title: "X" });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });
});
