import { describe, it, expect, vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListTaskNotebookSessionByStudentIdUseCase } from "./list-task-notebook-session-by-student-id-use-case";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { ActivityResultRepository } from "../../../../../domain/repositories/activity-result-repository";
import { ActivityResult } from "../../../../../domain/entities/activity-result";
import { makeWordBuilderTask } from "../../../task/use-cases/test-fixtures";
import { Educator } from "../../../../../domain/entities/educator";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";

const OWNER_ID = Uuid.random();
const STUDENT = makeStudent(OWNER_ID);

const makeSession = (studentId: Uuid, educatorId: Uuid = OWNER_ID) =>
  new TaskNotebookSession(
    Uuid.random(),
    studentId,
    educatorId,
    "Sessão",
    new Date("2026-11-10T13:00:00.000Z"),
    new Date("2026-11-10T13:40:00.000Z")
  );

const makeStudentRepository = () =>
  ({ getById: vi.fn().mockResolvedValue(STUDENT) }) as unknown as StudentRepository;

const makeEducatorRepository = (educators: Educator[] = []) =>
  ({
    getByIds: vi.fn(async (ids: Uuid[]) =>
      educators.filter((educator) => ids.some((id) => id.value === educator.id.value))
    ),
  }) as unknown as EducatorRepository;

describe("ListTaskNotebookSessionByStudentIdUseCase", () => {
  it("should add evolutionId to the sessions that have an evolution, with one batch query", async () => {
    const studentId = STUDENT.id;
    const withEvolution = makeSession(studentId);
    const withoutEvolution = makeSession(studentId);
    const evolutionId = Uuid.random().value;

    const sessionRepository = {
      listByStudentId: vi.fn().mockResolvedValue([withEvolution, withoutEvolution]),
    } as unknown as TaskNotebookSessionRepository;
    const evolutionRepository = {
      findIdsBySessionIds: vi
        .fn()
        .mockResolvedValue(new Map([[withEvolution.id.value, evolutionId]])),
    } as unknown as SessionEvolutionRepository;

    const activityResultRepository = {
      listBySessionIds: vi.fn().mockResolvedValue([]),
    } as unknown as ActivityResultRepository;

    const useCase = new ListTaskNotebookSessionByStudentIdUseCase(
      sessionRepository,
      makeStudentAccess(makeStudentRepository()),
      evolutionRepository,
      activityResultRepository,
      makeEducatorRepository()
    );

    const listed = await useCase.execute({ studentId: studentId.value, educatorId: OWNER_ID });
    if (!listed.ok) throw new Error(String(listed.error));
    const result = listed.value;

    expect(evolutionRepository.findIdsBySessionIds).toHaveBeenCalledTimes(1);
    expect(evolutionRepository.findIdsBySessionIds).toHaveBeenCalledWith([
      withEvolution.id,
      withoutEvolution.id,
    ]);
    expect(result[0].id).toBe(withEvolution.id);
    expect(result[0].name).toBe("Sessão");
    expect(result[0].evolutionId).toBe(evolutionId);
    expect(result[1].evolutionId).toBeUndefined();
    expect(JSON.parse(JSON.stringify(result[1]))).not.toHaveProperty("evolutionId");
  });

  it("RS-07: should add the activityResults of each session with one batch query", async () => {
    const studentId = STUDENT.id;
    const first = makeSession(studentId);
    const second = makeSession(studentId);
    const makeResult = (sessionId: Uuid) => {
      const created = ActivityResult.create({
        sessionId,
        task: makeWordBuilderTask(),
        completed: true,
        correct: false,
        attempts: 4,
        errors: 3,
        durationMs: 12000,
      });
      if (!created.ok) throw new Error(String(created.error));
      return created.value;
    };
    const firstResults = [makeResult(first.id), makeResult(first.id)];

    const sessionRepository = {
      listByStudentId: vi.fn().mockResolvedValue([first, second]),
    } as unknown as TaskNotebookSessionRepository;
    const evolutionRepository = {
      findIdsBySessionIds: vi.fn().mockResolvedValue(new Map()),
    } as unknown as SessionEvolutionRepository;
    const activityResultRepository = {
      listBySessionIds: vi.fn().mockResolvedValue(firstResults),
    } as unknown as ActivityResultRepository;

    const useCase = new ListTaskNotebookSessionByStudentIdUseCase(
      sessionRepository,
      makeStudentAccess(makeStudentRepository()),
      evolutionRepository,
      activityResultRepository,
      makeEducatorRepository()
    );

    const listed = await useCase.execute({ studentId: studentId.value, educatorId: OWNER_ID });
    if (!listed.ok) throw new Error(String(listed.error));
    const result = listed.value;

    expect(activityResultRepository.listBySessionIds).toHaveBeenCalledTimes(1);
    expect(activityResultRepository.listBySessionIds).toHaveBeenCalledWith([
      first.id,
      second.id,
    ]);
    expect(result[0].activityResults).toEqual(
      firstResults.map((item) => ({
        id: item.id.value,
        sessionId: first.id.value,
        taskId: item.taskId.value,
        taskType: "wordBuilder",
        completed: true,
        correct: false,
        attempts: 4,
        errors: 3,
        durationMs: 12000,
        recordedAt: item.recordedAt,
      }))
    );
    expect(result[1].activityResults).toEqual([]);
  });

  describe("access and authorship (RS-08, EQ-11, EQ-12)", () => {
    const colleague = Educator.create({
      name: "Bia",
      email: "bia@mail.com",
      password: "hash",
    });

    const build = (sessions: TaskNotebookSession[], shares = makeShareRepository()) => {
      const sessionRepository = {
        listByStudentId: vi.fn().mockResolvedValue(sessions),
      } as unknown as TaskNotebookSessionRepository;
      const educatorRepository = makeEducatorRepository([colleague]);
      const useCase = new ListTaskNotebookSessionByStudentIdUseCase(
        sessionRepository,
        makeStudentAccess(makeStudentRepository(), shares),
        { findIdsBySessionIds: vi.fn().mockResolvedValue(new Map()) } as unknown as SessionEvolutionRepository,
        { listBySessionIds: vi.fn().mockResolvedValue([]) } as unknown as ActivityResultRepository,
        educatorRepository
      );
      return { useCase, sessionRepository, educatorRepository };
    };

    it("should return UNAUTHORIZED for an educator without access to the student", async () => {
      const { useCase, sessionRepository } = build([makeSession(STUDENT.id)]);

      const result = await useCase.execute({
        studentId: STUDENT.id.value,
        educatorId: Uuid.random(),
      });

      expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
      expect(sessionRepository.listByStudentId).not.toHaveBeenCalled();
    });

    it("should list the sessions for an educator the student is shared with", async () => {
      const shares = makeShareRepository([shareStudent(STUDENT, colleague.id)]);
      const { useCase } = build([makeSession(STUDENT.id)], shares);

      const result = await useCase.execute({
        studentId: STUDENT.id.value,
        educatorId: colleague.id,
      });

      expect(result.ok).toBe(true);
      expect((result as any).value).toHaveLength(1);
    });

    it("should add authorName only to the sessions conducted by someone else", async () => {
      const byOwner = makeSession(STUDENT.id, OWNER_ID);
      const byColleague = makeSession(STUDENT.id, colleague.id);
      const { useCase, educatorRepository } = build([byOwner, byColleague]);

      const result = await useCase.execute({ studentId: STUDENT.id.value, educatorId: OWNER_ID });
      if (!result.ok) throw new Error(String(result.error));

      expect(result.value[0].authorName).toBeUndefined();
      expect(JSON.parse(JSON.stringify(result.value[0]))).not.toHaveProperty("authorName");
      expect(result.value[1].authorName).toBe("Bia");
      // Uma busca em lote só, sem o próprio leitor.
      expect(educatorRepository.getByIds).toHaveBeenCalledTimes(1);
      expect((educatorRepository.getByIds as any).mock.calls[0][0]).toEqual([colleague.id]);
    });
  });
});
