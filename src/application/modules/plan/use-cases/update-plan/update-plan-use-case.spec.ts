import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UpdatePlanUseCase } from "./update-plan-use-case";
import { updatePlanSchema } from "../../schemas/update-plan.schema";
import { Plan, PlanSource, PlanStatus, PlanType } from "../../../../../domain/entities/plan";
import { Gender, Student } from "../../../../../domain/entities/student";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
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
  let shareRepository: ReturnType<typeof makeShareRepository>;
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
    shareRepository = makeShareRepository();
    useCase = new UpdatePlanUseCase(planRepository, makeStudentAccess(studentRepository, shareRepository));
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

  it("should let a colleague the student is shared with edit the owner plan", async () => {
    const plan = makePlan(educatorId, student.id);
    (planRepository.findById as any).mockResolvedValue(plan);
    const colleagueId = Uuid.random();
    await shareRepository.create(shareStudent(student, colleagueId));

    const result = await useCase.execute({
      educatorId: colleagueId,
      planId: plan.id.value,
      title: "Título do colega",
    });

    expect(result.ok).toBe(true);
    const updated = (result as any).value as Plan;
    expect(updated.title).toBe("Título do colega");
    // O autor gravado continua o dono (EQ-12).
    expect(updated.educatorId.value).toBe(educatorId.value);
  });

  it("should return UNAUTHORIZED to an educator the student is not shared with", async () => {
    const plan = makePlan(educatorId, student.id);
    (planRepository.findById as any).mockResolvedValue(plan);

    const result = await useCase.execute({
      educatorId: Uuid.random(),
      planId: plan.id.value,
      title: "X",
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("null apaga nextReviewDate e professionalNotes; ausente mantém (PP-05)", async () => {
    const created = Plan.create({
      educatorId,
      studentId: student.id,
      type: PlanType.PDI,
      source: PlanSource.MANUAL,
      title: "PDI",
      generalObjective: "Objetivo",
      professionalNotes: "Nota",
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      nextReviewDate: "2026-03-01",
      goals: [{ description: "Meta" }],
    });
    if (!created.ok) throw new Error(created.error);
    (planRepository.findById as any).mockResolvedValue(created.value);

    const cleared = await useCase.execute({
      educatorId,
      planId: created.value.id.value,
      nextReviewDate: null,
    });

    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    expect(cleared.value.nextReviewDate).toBeUndefined();
    expect(cleared.value.professionalNotes).toBe("Nota");

    (planRepository.findById as any).mockResolvedValue(cleared.value);
    const clearedNotes = await useCase.execute({
      educatorId,
      planId: created.value.id.value,
      professionalNotes: null,
    });

    expect(clearedNotes.ok).toBe(true);
    if (!clearedNotes.ok) return;
    expect(clearedNotes.value.professionalNotes).toBeUndefined();
  });
});

describe("updatePlanSchema (PP-05)", () => {
  it("aceita null em nextReviewDate e professionalNotes", () => {
    expect(
      updatePlanSchema.safeParse({ nextReviewDate: null, professionalNotes: null }).data
    ).toEqual({ nextReviewDate: null, professionalNotes: null });
  });

  it("ausente continua ausente", () => {
    expect(updatePlanSchema.safeParse({ title: "Novo" }).data).toEqual({ title: "Novo" });
  });
});
