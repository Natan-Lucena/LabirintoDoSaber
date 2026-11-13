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
  let useCase: ListSessionEvolutionsUseCase;

  beforeEach(() => {
    evolutionRepository = {
      search: vi.fn().mockResolvedValue([]),
    } as unknown as SessionEvolutionRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(ana),
      search: vi.fn().mockResolvedValue([ana, bruno]),
    } as unknown as StudentRepository;
    useCase = new ListSessionEvolutionsUseCase(evolutionRepository, studentRepository);
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
