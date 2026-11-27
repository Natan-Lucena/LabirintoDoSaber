import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListSessionEvolutionsUseCase } from "./list-session-evolutions-use-case";
import {
  CriterionResult,
  SessionEvolution,
} from "../../../../../domain/entities/session-evolution";
import { Student } from "../../../../../domain/entities/student";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { Educator } from "../../../../../domain/entities/educator";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { makeSession, makeStudent } from "../test-fixtures";

const makeEvolution = (
  student: Student,
  educatorId: Uuid,
  startedAt: string,
  descriptiveRecord = "Registro"
) => {
  const created = SessionEvolution.create({
    session: makeSession({
      studentId: student.id,
      educatorId,
      startedAt: new Date(startedAt),
    }),
    educatorId,
    criteria: [
      { description: "A", result: CriterionResult.ACHIEVED },
      { description: "B", result: CriterionResult.PARTIAL },
      { description: "C", result: CriterionResult.ACHIEVED },
    ],
    descriptiveRecord,
  });
  if (!created.ok) throw new Error(created.error);
  return created.value;
};

describe("ListSessionEvolutionsUseCase", () => {
  const educatorId = Uuid.random();
  const ana = makeStudent(educatorId, "Ana");
  const bruno = makeStudent(educatorId, "Bruno");

  let evolutionRepository: SessionEvolutionRepository;
  let studentRepository: StudentRepository;
  let educatorRepository: EducatorRepository;
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let useCase: ListSessionEvolutionsUseCase;

  beforeEach(() => {
    evolutionRepository = {
      search: vi.fn().mockResolvedValue([]),
    } as unknown as SessionEvolutionRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(ana),
      search: vi.fn().mockResolvedValue([ana, bruno]),
      getByIds: vi.fn().mockResolvedValue([]),
    } as unknown as StudentRepository;
    educatorRepository = {
      getByIds: vi.fn().mockResolvedValue([]),
    } as unknown as EducatorRepository;
    shareRepository = makeShareRepository();
    useCase = new ListSessionEvolutionsUseCase(
      evolutionRepository,
      makeStudentAccess(studentRepository, shareRepository),
      educatorRepository
    );
  });

  it("should search by the student only, without filtering by the recorded author", async () => {
    await useCase.execute({
      educatorId,
      studentId: ana.id.value,
      from: "2026-11-01",
      to: "2026-11-30",
      limit: 10,
    });

    expect(evolutionRepository.search).toHaveBeenCalledWith({
      studentIds: [ana.id],
      from: "2026-11-01",
      to: "2026-11-30",
      limit: 10,
    });
    expect(studentRepository.search).not.toHaveBeenCalled();
  });

  it("should search by the educator's current students and let the database apply the limit", async () => {
    await useCase.execute({ educatorId, limit: 5 });

    expect(studentRepository.search).toHaveBeenCalledWith({ educatorId });
    expect(evolutionRepository.search).toHaveBeenCalledWith({
      studentIds: [ana.id, bruno.id],
      from: undefined,
      to: undefined,
      limit: 5,
    });
  });

  it("should include evolutions written by a previous owner of the student", async () => {
    const previousOwner = Uuid.random();
    const inherited = makeEvolution(ana, previousOwner, "2026-11-12T13:00:00.000Z");
    (evolutionRepository.search as any).mockResolvedValue([inherited]);

    const summaries = ((await useCase.execute({ educatorId, limit: 50 })) as any).value;

    expect(summaries.map((s: any) => s.id)).toEqual([inherited.id.value]);
    expect(summaries[0].studentName).toBe("Ana");
  });

  it("should build summaries keeping the repository order (most recent first)", async () => {
    const longRecord = "x".repeat(250);
    const recent = makeEvolution(ana, educatorId, "2026-11-12T13:00:00.000Z", longRecord);
    const older = makeEvolution(bruno, educatorId, "2026-11-05T13:00:00.000Z");
    (evolutionRepository.search as any).mockResolvedValue([recent, older]);

    const result = await useCase.execute({ educatorId, limit: 50 });

    expect(result.ok).toBe(true);
    const summaries = (result as any).value;
    expect(summaries).toEqual([
      {
        id: recent.id.value,
        sessionId: recent.sessionId.value,
        studentId: ana.id.value,
        studentName: "Ana",
        sessionDate: "2026-11-12",
        planTitle: undefined,
        criteriaCount: 3,
        achievedCount: 2,
        excerpt: "x".repeat(200),
        authorName: undefined,
        createdAt: recent.createdAt,
      },
      expect.objectContaining({
        id: older.id.value,
        studentName: "Bruno",
        sessionDate: "2026-11-05",
        excerpt: "Registro",
      }),
    ]);
  });

  describe("shared students (EQ-11, EQ-12, EQ-13)", () => {
    const colleagueId = Uuid.random();
    const owner = Educator.create({ name: "Dona Marta", email: "m@mail.com", password: "x" });
    const carla = makeStudent(owner.id, "Carla");

    it("should list the evolutions of a student shared with the educator, with the author's name", async () => {
      await shareRepository.create(shareStudent(carla, colleagueId));
      (studentRepository.getById as any).mockResolvedValue(carla);
      (educatorRepository.getByIds as any).mockResolvedValue([owner]);
      const byOwner = makeEvolution(carla, owner.id, "2026-11-12T13:00:00.000Z");
      const byColleague = makeEvolution(carla, colleagueId, "2026-11-05T13:00:00.000Z");
      (evolutionRepository.search as any).mockResolvedValue([byOwner, byColleague]);

      const result = await useCase.execute({
        educatorId: colleagueId,
        studentId: carla.id.value,
        limit: 50,
      });

      const summaries = (result as any).value;
      expect(summaries.map((s: any) => [s.id, s.studentName, s.authorName])).toEqual([
        [byOwner.id.value, "Carla", "Dona Marta"],
        [byColleague.id.value, "Carla", undefined],
      ]);
      expect((educatorRepository.getByIds as any).mock.calls[0][0]).toEqual([owner.id]);
    });

    it("should include the shared students when no student is informed", async () => {
      await shareRepository.create(shareStudent(carla, colleagueId));
      (studentRepository.search as any).mockResolvedValue([]);
      (studentRepository.getByIds as any).mockResolvedValue([carla]);

      await useCase.execute({ educatorId: colleagueId, limit: 5 });

      expect(evolutionRepository.search).toHaveBeenCalledWith({
        studentIds: [carla.id],
        from: undefined,
        to: undefined,
        limit: 5,
      });
    });

    it("should return UNAUTHORIZED after the share is undone", async () => {
      await shareRepository.create(shareStudent(carla, colleagueId));
      await shareRepository.delete(carla.id, colleagueId);
      (studentRepository.getById as any).mockResolvedValue(carla);

      const result = await useCase.execute({
        educatorId: colleagueId,
        studentId: carla.id.value,
        limit: 50,
      });

      expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
      expect(evolutionRepository.search).not.toHaveBeenCalled();
    });
  });

  it("should return UNAUTHORIZED for a student of another educator", async () => {
    (studentRepository.getById as any).mockResolvedValue(makeStudent(Uuid.random()));

    const result = await useCase.execute({
      educatorId,
      studentId: Uuid.random().value,
      limit: 50,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(evolutionRepository.search).not.toHaveBeenCalled();
  });

  it("should return STUDENT_NOT_FOUND for a missing student", async () => {
    (studentRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      educatorId,
      studentId: Uuid.random().value,
      limit: 50,
    });

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });
});
