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
import { Educator } from "../../../../../domain/entities/educator";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import {
  makeShareRepository,
  makeStudentAccess,
  makeStudentRepositoryFake,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";

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
  let studentRepository: ReturnType<typeof makeStudentRepositoryFake>;
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let educatorRepository: EducatorRepository;
  let useCase: ListPlansUseCase;

  const educatorId = Uuid.random();
  const ana = makeStudent(educatorId, "Ana");
  const bruno = makeStudent(educatorId, "Bruno");
  const owner = Educator.create({
    name: "Dona Clara",
    email: "clara@mail.com",
    password: "hash",
  });
  const carla = makeStudent(owner.id, "Carla");

  beforeEach(() => {
    vi.restoreAllMocks();
    planRepository = {
      search: vi.fn().mockResolvedValue([]),
    } as unknown as PlanRepository;
    studentRepository = makeStudentRepositoryFake([ana, bruno, carla]);
    shareRepository = makeShareRepository();
    educatorRepository = {
      getByIds: vi.fn(async (ids: Uuid[]) =>
        [owner].filter((educator) => ids.some((id) => id.value === educator.id.value))
      ),
    } as unknown as EducatorRepository;
    useCase = new ListPlansUseCase(
      planRepository,
      makeStudentAccess(studentRepository, shareRepository),
      educatorRepository
    );
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
    expect(summaries[0].authorName).toBeUndefined();
    expect(educatorRepository.getByIds).not.toHaveBeenCalled();
  });

  it("should search the plans of the accessible students only, by student", async () => {
    await useCase.execute({ educatorId });

    expect(planRepository.search).toHaveBeenCalledWith({
      studentIds: [ana.id, bruno.id],
      status: undefined,
      type: undefined,
    });
  });

  it("should hide plans of students that now belong to another educator", async () => {
    // O repositório devolve um plano de aluno fora do alcance (ex.: transferido).
    const plan = makePlan(educatorId, carla.id, {});
    (planRepository.search as any).mockResolvedValue([plan]);

    const result = await useCase.execute({ educatorId });

    expect(result.ok).toBe(true);
    expect((result as any).value).toEqual([]);
  });

  it("should list the plans of a shared student, written by the owner, with authorName (EQ-11, EQ-12)", async () => {
    await shareRepository.create(shareStudent(carla, educatorId));
    const ownerPlan = makePlan(owner.id, carla.id, {});
    const myPlan = makePlan(educatorId, carla.id, { type: PlanType.PE });
    (planRepository.search as any).mockResolvedValue([ownerPlan, myPlan]);

    const result = await useCase.execute({ educatorId });

    expect(planRepository.search).toHaveBeenCalledWith(
      expect.objectContaining({ studentIds: [ana.id, bruno.id, carla.id] })
    );
    const summaries = (result as any).value;
    const byId = new Map(summaries.map((s: any) => [s.id, s]));
    expect(byId.get(ownerPlan.id.value)).toMatchObject({
      studentName: "Carla",
      authorName: "Dona Clara",
    });
    expect((byId.get(myPlan.id.value) as any).authorName).toBeUndefined();
    expect(educatorRepository.getByIds).toHaveBeenCalledOnce();
  });

  it("should pass the filters to the repository", async () => {
    await useCase.execute({
      educatorId,
      studentId: ana.id.value,
      status: PlanStatus.ACTIVE,
      type: PlanType.PDI,
    });

    expect(planRepository.search).toHaveBeenCalledWith({
      studentIds: [ana.id],
      status: PlanStatus.ACTIVE,
      type: PlanType.PDI,
    });
  });

  it("should list the plans of a student shared with the educator", async () => {
    await shareRepository.create(shareStudent(carla, educatorId));

    const result = await useCase.execute({ educatorId, studentId: carla.id.value });

    expect(result.ok).toBe(true);
    expect(planRepository.search).toHaveBeenCalledWith(
      expect.objectContaining({ studentIds: [carla.id] })
    );
  });

  it("should return UNAUTHORIZED when filtering by a student of another educator", async () => {
    const result = await useCase.execute({ educatorId, studentId: carla.id.value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(planRepository.search).not.toHaveBeenCalled();
  });

  it("should return STUDENT_NOT_FOUND when filtering by an unknown student", async () => {
    const result = await useCase.execute({ educatorId, studentId: Uuid.random().value });

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });
});
