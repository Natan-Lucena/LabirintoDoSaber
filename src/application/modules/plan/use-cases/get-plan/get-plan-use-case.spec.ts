import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GetPlanUseCase } from "./get-plan-use-case";
import { Plan, PlanSource, PlanType } from "../../../../../domain/entities/plan";
import { Gender, Student } from "../../../../../domain/entities/student";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";

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

const makePlan = (educatorId: Uuid, studentId: Uuid = Uuid.random()) => {
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

describe("GetPlanUseCase", () => {
  let planRepository: PlanRepository;
  let studentRepository: StudentRepository;
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let educatorRepository: EducatorRepository;
  let useCase: GetPlanUseCase;
  const educatorId = Uuid.random();
  const owner = Educator.create({ name: "Dona Clara", email: "clara@mail.com", password: "hash" });
  const student = makeStudent(educatorId);

  beforeEach(() => {
    vi.restoreAllMocks();
    planRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as PlanRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    shareRepository = makeShareRepository();
    educatorRepository = {
      getByIds: vi.fn().mockResolvedValue([owner]),
    } as unknown as EducatorRepository;
    useCase = new GetPlanUseCase(
      planRepository,
      makeStudentAccess(studentRepository, shareRepository),
      educatorRepository
    );
  });

  it("should return the plan when the educator is the owner", async () => {
    const plan = makePlan(educatorId, student.id);
    (planRepository.findById as any).mockResolvedValue(plan);

    const result = await useCase.execute({ educatorId, planId: plan.id.value });

    expect(result).toEqual({ ok: true, value: { plan, authorName: undefined } });
    expect(educatorRepository.getByIds).not.toHaveBeenCalled();
  });

  it("should return the plan of a student shared with the educator, with the author name (EQ-11, EQ-12)", async () => {
    const colleagueId = Uuid.random();
    const ownedByOther = makeStudent(owner.id);
    await shareRepository.create(shareStudent(ownedByOther, colleagueId));
    (studentRepository.getById as any).mockResolvedValue(ownedByOther);
    const plan = makePlan(owner.id, ownedByOther.id);
    (planRepository.findById as any).mockResolvedValue(plan);

    const result = await useCase.execute({ educatorId: colleagueId, planId: plan.id.value });

    expect(result).toEqual({ ok: true, value: { plan, authorName: "Dona Clara" } });
  });

  it("should return UNAUTHORIZED after the share is undone", async () => {
    const colleagueId = Uuid.random();
    await shareRepository.create(shareStudent(student, colleagueId));
    await shareRepository.delete(student.id, colleagueId);
    const plan = makePlan(educatorId, student.id);
    (planRepository.findById as any).mockResolvedValue(plan);

    const result = await useCase.execute({ educatorId: colleagueId, planId: plan.id.value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return the plan written by another educator on the owner's student", async () => {
    // O acesso é pelo aluno, não pelo autor gravado.
    const plan = makePlan(owner.id, student.id);
    (planRepository.findById as any).mockResolvedValue(plan);

    const result = await useCase.execute({ educatorId, planId: plan.id.value });

    expect(result).toEqual({ ok: true, value: { plan, authorName: "Dona Clara" } });
  });

  it("should return UNAUTHORIZED when the plan's student is not accessible", async () => {
    const plan = makePlan(Uuid.random());
    (planRepository.findById as any).mockResolvedValue(plan);
    (studentRepository.getById as any).mockResolvedValue(makeStudent(Uuid.random()));

    const result = await useCase.execute({ educatorId, planId: plan.id.value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return UNAUTHORIZED when the student now belongs to another educator", async () => {
    const plan = makePlan(educatorId, student.id);
    (planRepository.findById as any).mockResolvedValue(plan);
    (studentRepository.getById as any).mockResolvedValue(makeStudent(Uuid.random()));

    const result = await useCase.execute({ educatorId, planId: plan.id.value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return PLAN_NOT_FOUND when the plan does not exist", async () => {
    const result = await useCase.execute({ educatorId, planId: Uuid.random().value });

    expect(result).toEqual({ ok: false, error: "PLAN_NOT_FOUND" });
  });

  it("should return PLAN_NOT_FOUND when the id is not a valid uuid", async () => {
    const result = await useCase.execute({ educatorId, planId: "abc" });

    expect(result).toEqual({ ok: false, error: "PLAN_NOT_FOUND" });
    expect(planRepository.findById).not.toHaveBeenCalled();
  });
});
