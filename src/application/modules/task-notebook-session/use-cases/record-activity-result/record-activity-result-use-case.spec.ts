import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { RecordActivityResultUseCase } from "./record-activity-result-use-case";
import { ActivityResult } from "../../../../../domain/entities/activity-result";
import { TaskType } from "../../../../../domain/entities/task";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import {
  ActivityResultAlreadyExistsError,
  ActivityResultRepository,
} from "../../../../../domain/repositories/activity-result-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { makeSession, makeStudent } from "../../../session-evolution/use-cases/test-fixtures";
import {
  makeMultipleChoiceTask,
  makePrintableTask,
  makeTaskRepository,
  makeWordBuilderTask,
} from "../../../task/use-cases/test-fixtures";

describe("RecordActivityResultUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);
  const task = makeWordBuilderTask();
  const notebookId = Uuid.random();

  let session: TaskNotebookSession;
  let sessionRepository: TaskNotebookSessionRepository;
  let studentRepository: StudentRepository;
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let notebookRepository: TaskNotebookRepository;
  let taskGroupRepository: TaskGroupRepository;
  let resultRepository: ActivityResultRepository;
  let useCase: RecordActivityResultUseCase;

  const openSession = (taskNotebookId?: Uuid) =>
    new TaskNotebookSession(
      Uuid.random(),
      student.id,
      educatorId,
      "Sessão",
      new Date(),
      undefined,
      [],
      undefined,
      taskNotebookId
    );

  beforeEach(() => {
    session = openSession();
    sessionRepository = {
      getById: vi.fn().mockImplementation(async () => session),
      save: vi.fn(),
    } as unknown as TaskNotebookSessionRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    taskRepository = makeTaskRepository();
    taskRepository.getById.mockResolvedValue(task);
    notebookRepository = {
      getById: vi.fn(),
    } as unknown as TaskNotebookRepository;
    taskGroupRepository = {
      findByIds: vi.fn().mockResolvedValue([]),
    } as unknown as TaskGroupRepository;
    resultRepository = {
      save: vi.fn(),
      findBySessionAndTask: vi.fn().mockResolvedValue(null),
      listBySessionId: vi.fn().mockResolvedValue([]),
      listBySessionIds: vi.fn().mockResolvedValue([]),
    } as unknown as ActivityResultRepository;

    useCase = new RecordActivityResultUseCase(
      sessionRepository,
      studentRepository,
      taskRepository,
      notebookRepository,
      taskGroupRepository,
      resultRepository
    );
  });

  const execute = (
    overrides: Partial<{ educatorId: Uuid; sessionId: string; taskId: string }> = {}
  ) =>
    useCase.execute({
      educatorId: overrides.educatorId ?? educatorId,
      sessionId: overrides.sessionId ?? session.id.value,
      taskId: overrides.taskId ?? task.id.value,
      completed: true,
      correct: false,
      attempts: 3,
      errors: 2,
      durationMs: 30000,
    });

  it("should record the result of a playable task in an open session", async () => {
    const result = await execute();

    expect(result.ok).toBe(true);
    const saved = (resultRepository.save as any).mock.calls[0][0] as ActivityResult;
    expect(saved.sessionId.value).toBe(session.id.value);
    expect(saved.taskId.value).toBe(task.id.value);
    expect(saved.taskType).toBe(TaskType.WordBuilder);
    expect(saved.completed).toBe(true);
    expect(saved.correct).toBe(false);
    expect(saved.attempts).toBe(3);
    expect(saved.errors).toBe(2);
    expect(saved.durationMs).toBe(30000);
    expect((result as any).value).toBe(saved);
  });

  it("RS-05: should not touch the session answers", async () => {
    await execute();

    expect(sessionRepository.save).not.toHaveBeenCalled();
  });

  it("RS-01: should return SESSION_NOT_FOUND for a missing session or an invalid id", async () => {
    expect(await execute({ sessionId: "abc" })).toEqual({
      ok: false,
      error: "SESSION_NOT_FOUND",
    });

    (sessionRepository.getById as any).mockResolvedValue(null);
    expect(await execute()).toEqual({ ok: false, error: "SESSION_NOT_FOUND" });
    expect(resultRepository.save).not.toHaveBeenCalled();
  });

  it("BE-RS-02: should return SESSION_ALREADY_FINISHED after the finish", async () => {
    session = makeSession({ studentId: student.id, educatorId });

    expect(await execute()).toEqual({ ok: false, error: "SESSION_ALREADY_FINISHED" });
    expect(resultRepository.save).not.toHaveBeenCalled();
  });

  it("RS-08: should return UNAUTHORIZED when the educator does not own the student", async () => {
    expect(await execute({ educatorId: Uuid.random() })).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(taskRepository.getById).not.toHaveBeenCalled();
    expect(resultRepository.save).not.toHaveBeenCalled();
  });

  it("should return TASK_NOT_FOUND for a missing task", async () => {
    taskRepository.getById.mockResolvedValue(null);

    expect(await execute()).toEqual({ ok: false, error: "TASK_NOT_FOUND" });
    expect(resultRepository.save).not.toHaveBeenCalled();
  });

  it("RS-03: should return USE_ANSWER_ROUTE for multiple choice", async () => {
    const multipleChoice = makeMultipleChoiceTask();
    taskRepository.getById.mockResolvedValue(multipleChoice);

    expect(await execute({ taskId: multipleChoice.id.value })).toEqual({
      ok: false,
      error: "USE_ANSWER_ROUTE",
    });
    expect(resultRepository.save).not.toHaveBeenCalled();
  });

  it("RS-03: should return PRINTABLE_NOT_PLAYABLE for a printable task", async () => {
    const printable = makePrintableTask();
    taskRepository.getById.mockResolvedValue(printable);

    expect(await execute({ taskId: printable.id.value })).toEqual({
      ok: false,
      error: "PRINTABLE_NOT_PLAYABLE",
    });
    expect(resultRepository.save).not.toHaveBeenCalled();
  });

  describe("RS-02: session with a notebook", () => {
    beforeEach(() => {
      session = openSession(notebookId);
    });

    it("should accept a task that is directly in the notebook", async () => {
      (notebookRepository.getById as any).mockResolvedValue({
        id: notebookId,
        tasks: [{ id: task.id }],
        taskGroupsIds: [],
      });

      expect((await execute()).ok).toBe(true);
      expect(taskGroupRepository.findByIds).not.toHaveBeenCalled();
    });

    it("should accept a task that belongs to a group of the notebook", async () => {
      const groupId = Uuid.random().value;
      (notebookRepository.getById as any).mockResolvedValue({
        id: notebookId,
        tasks: [],
        taskGroupsIds: [groupId],
      });
      (taskGroupRepository.findByIds as any).mockResolvedValue([
        { id: new Uuid(groupId), tasksIds: [task.id.value] },
      ]);

      expect((await execute()).ok).toBe(true);
    });

    it("should return TASK_NOT_IN_NOTEBOOK when the task is outside the notebook", async () => {
      (notebookRepository.getById as any).mockResolvedValue({
        id: notebookId,
        tasks: [{ id: Uuid.random() }],
        taskGroupsIds: [Uuid.random().value],
      });
      (taskGroupRepository.findByIds as any).mockResolvedValue([
        { id: Uuid.random(), tasksIds: [Uuid.random().value] },
      ]);

      expect(await execute()).toEqual({ ok: false, error: "TASK_NOT_IN_NOTEBOOK" });
      expect(resultRepository.save).not.toHaveBeenCalled();
    });

    it("should return NOTEBOOK_NOT_FOUND when the notebook was deleted", async () => {
      (notebookRepository.getById as any).mockResolvedValue(null);

      expect(await execute()).toEqual({ ok: false, error: "NOTEBOOK_NOT_FOUND" });
    });
  });

  describe("RS-04: one result per task and session", () => {
    it("BE-RS-01: should return RESULT_ALREADY_EXISTS with the resultId on a second send", async () => {
      const first = await execute();
      if (!first.ok) throw new Error(String(first.error));
      (resultRepository.findBySessionAndTask as any).mockResolvedValue(first.value);

      const second = await execute();

      expect(second).toEqual({
        ok: false,
        error: { code: "RESULT_ALREADY_EXISTS", resultId: first.value.id.value },
      });
      expect(resultRepository.findBySessionAndTask).toHaveBeenLastCalledWith(
        session.id,
        task.id
      );
      expect(resultRepository.save).toHaveBeenCalledTimes(1);
    });

    it("should return the winner's resultId when a parallel send hits the unique index", async () => {
      const winner = ActivityResult.create({
        sessionId: session.id,
        task,
        completed: true,
        correct: true,
        attempts: 1,
        errors: 0,
        durationMs: 1000,
      });
      if (!winner.ok) throw new Error(String(winner.error));
      (resultRepository.save as any).mockRejectedValue(new ActivityResultAlreadyExistsError());
      (resultRepository.findBySessionAndTask as any)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(winner.value);

      expect(await execute()).toEqual({
        ok: false,
        error: { code: "RESULT_ALREADY_EXISTS", resultId: winner.value.id.value },
      });
    });

    it("should rethrow other persistence errors", async () => {
      (resultRepository.save as any).mockRejectedValue(new Error("db down"));

      await expect(execute()).rejects.toThrow("db down");
    });
  });
});
