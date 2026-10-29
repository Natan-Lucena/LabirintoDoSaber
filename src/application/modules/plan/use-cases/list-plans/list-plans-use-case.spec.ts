import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListPlansUseCase } from "./list-plans-use-case";
import {
  Plan,
  PlanProps,
  PlanSource,
  PlanStatus,
  PlanType,
} from "../../../../../domain/entities/plan";
import { Gender, Student } from "../../../../../domain/entities/student";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";

const makeStudent = (educatorId: Uuid, name: string) =>
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

const makePlan = (
  educatorId: Uuid,
  studentId: Uuid,
  overrides: Partial<PlanProps>
): Plan =>
  Plan.fromPersistence({
    id: Uuid.random(),
    educatorId,
    studentId,
    type: PlanType.PDI,
    status: PlanStatus.ACTIVE,
    source: PlanSource.MANUAL,
    title: "Plano",
    generalObjective: "Objetivo",
    consideredDifficulties: [],
    startDate: "2026-01-01",
    endDate: "2026-06-30",
    goals: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });

describe("ListPlansUseCase", () => {
  let planRepository: PlanRepository;
  let studentRepository: StudentRepository;
  let useCase: ListPlansUseCase;

  const educatorId = Uuid.random();
  const ana = makeStudent(educatorId, "Ana");
  const bruno = makeStudent(educatorId, "Bruno");

  beforeEach(() => {
    vi.restoreAllMocks();
    planRepository = {
      search: vi.fn().mockResolvedValue([]),
    } as unknown as PlanRepository;
    studentRepository = {
      getById: vi.fn(),
      getByIds: vi.fn().mockResolvedValue([ana, bruno]),
    } as unknown as StudentRepository;
    useCase = new ListPlansUseCase(planRepository, studentRepository);
  });

  it("should list ACTIVE plans first, then by updatedAt desc, with the student name", async () => {
    const closedRecent = makePlan(educatorId, ana.id, {
      status: PlanStatus.COMPLETED,
      updatedAt: new Date("2026-05-01T00:00:00Z"),
    });
    const activeOld = makePlan(educatorId, bruno.id, {
      type: PlanType.PE,
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    });
    const activeRecent = makePlan(educatorId, ana.id, {
      updatedAt: new Date("2026-04-01T00:00:00Z"),
    });
    (planRepository.search as any).mockResolvedValue([closedRecent, activeRecent, activeOld]);

    const result = await useCase.execute({ educatorId });

    expect(result.ok).toBe(true);
    const summaries = (result as any).value;
    expect(summaries.map((s: any) => s.id)).toEqual([
      activeRecent.id.value,
      activeOld.id.value,
      closedRecent.id.value,
    ]);
    expect(summaries.map((s: any) => s.studentName)).toEqual(["Ana", "Bruno", "Ana"]);
    expect(summaries[0]).not.toHaveProperty("goals");
    expect(summaries[0]).toHaveProperty("progress");
    expect(studentRepository.getByIds).toHaveBeenCalledOnce();
  });

  it("should hide plans of students that now belong to another educator", async () => {
    const transferred = makeStudent(Uuid.random(), "Carla");
    const plan = makePlan(educatorId, transferred.id, {});
    (planRepository.search as any).mockResolvedValue([plan]);
    (studentRepository.getByIds as any).mockResolvedValue([transferred]);

    const result = await useCase.execute({ educatorId });

    expect(result.ok).toBe(true);
    expect((result as any).value).toEqual([]);
  });

  it("should pass the filters to the repository", async () => {
    (studentRepository.getById as any).mockResolvedValue(ana);

    await useCase.execute({
      educatorId,
      studentId: ana.id.value,
      status: PlanStatus.ACTIVE,
      type: PlanType.PDI,
    });

    expect(planRepository.search).toHaveBeenCalledWith({
      educatorId,
      studentId: ana.id,
      status: PlanStatus.ACTIVE,
      type: PlanType.PDI,
    });
  });

  it("should return UNAUTHORIZED when filtering by a student of another educator", async () => {
    (studentRepository.getById as any).mockResolvedValue(makeStudent(Uuid.random(), "Carla"));

    const result = await useCase.execute({ educatorId, studentId: Uuid.random().value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(planRepository.search).not.toHaveBeenCalled();
  });
});
