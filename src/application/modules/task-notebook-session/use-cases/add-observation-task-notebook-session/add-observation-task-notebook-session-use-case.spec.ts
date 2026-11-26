import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { AddObservationTaskNotebookSessionUseCase } from "./add-observation-task-notebook-session-use-case";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { makeSession, makeStudent } from "../../../session-evolution/use-cases/test-fixtures";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";

describe("AddObservationTaskNotebookSessionUseCase", () => {
  const ownerId = Uuid.random();
  const student = makeStudent(ownerId);

  let session: TaskNotebookSession;
  let sessionRepository: TaskNotebookSessionRepository;
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let useCase: AddObservationTaskNotebookSessionUseCase;

  beforeEach(() => {
    session = makeSession({ studentId: student.id, educatorId: ownerId });
    sessionRepository = {
      getById: vi.fn().mockImplementation(async () => session),
      save: vi.fn(),
    } as unknown as TaskNotebookSessionRepository;
    const studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    shareRepository = makeShareRepository();
    useCase = new AddObservationTaskNotebookSessionUseCase(
      sessionRepository,
      makeStudentAccess(studentRepository, shareRepository)
    );
  });

  const execute = (educatorId: Uuid, sessionId = session.id.value) =>
    useCase.execute({ sessionId, educatorId, observation: "Leu bem" });

  it("should save the observation of a finished session for the owner", async () => {
    const result = await execute(ownerId);

    expect(result.ok).toBe(true);
    const saved = (sessionRepository.save as any).mock.calls[0][0] as TaskNotebookSession;
    expect(saved.observation).toBe("Leu bem");
  });

  it("EQ-11: should let an educator the student is shared with add the observation", async () => {
    const colleagueId = Uuid.random();
    shareRepository.store.push(shareStudent(student, colleagueId));

    const result = await execute(colleagueId);

    expect(result.ok).toBe(true);
    expect(sessionRepository.save).toHaveBeenCalledTimes(1);
  });

  it("RS-08: should return UNAUTHORIZED for an educator without access", async () => {
    expect(await execute(Uuid.random())).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(sessionRepository.save).not.toHaveBeenCalled();
  });

  it("should return SESSION_NOT_FOUND for a missing session or an invalid id", async () => {
    expect(await execute(ownerId, "abc")).toEqual({ ok: false, error: "SESSION_NOT_FOUND" });

    (sessionRepository.getById as any).mockResolvedValue(null);
    expect(await execute(ownerId)).toEqual({ ok: false, error: "SESSION_NOT_FOUND" });
  });

  it("should return SESSION_NOT_FINISHED for an open session", async () => {
    session = makeSession({ studentId: student.id, educatorId: ownerId, finishedAt: null });

    expect(await execute(ownerId)).toEqual({ ok: false, error: "SESSION_NOT_FINISHED" });
  });
});
