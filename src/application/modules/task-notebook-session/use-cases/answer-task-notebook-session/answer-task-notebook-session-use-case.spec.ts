import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";

import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import {
  TaskAnswer,
  TaskNotebookSession,
} from "../../../../../domain/entities/task-notebook-session";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { AnswerTaskNotebookSessionUseCase } from "./answer-task-notebook-session-use-case";

const ID = {
  session: Uuid.random().value,
  task: Uuid.random().value,
  altCorrect: Uuid.random().value,
  altWrong: Uuid.random().value,
  notebook: Uuid.random().value,
};

const makeSession = (
  sessionId: string,
  notebookId: string,
  finished = false,
  answers: TaskAnswer[] = []
) => {
  const session = {
    id: new Uuid(sessionId),
    notebookId: new Uuid(notebookId),
    finishedAt: finished ? new Date() : undefined,
    answers,
    answerTask: vi.fn().mockImplementation((a: TaskAnswer) =>
      success({
        ...session,
        answers: [...session.answers, a],
      })
    ),
  };

  return session;
};

const makeTask = (taskId: string, correctAltId: string) => ({
  id: new Uuid(taskId),
  alternatives: [
    { id: new Uuid(correctAltId), isCorrect: true },
    { id: new Uuid(ID.altWrong), isCorrect: false },
  ],
});

const makeNotebook = (notebookId: string, taskIds: string[]) => ({
  id: new Uuid(notebookId),
  tasks: taskIds.map((id) => ({ id: new Uuid(id) })),
});

const mockSessionRepository = (): TaskNotebookSessionRepository =>
  ({
    getById: vi.fn(),
    save: vi.fn(),
  } as unknown as TaskNotebookSessionRepository);

const mockTaskRepository = (): TaskRepository =>
  ({
    getById: vi.fn(),
  } as unknown as TaskRepository);

const mockNotebookRepository = (): TaskNotebookRepository =>
  ({
    getById: vi.fn(),
  } as unknown as TaskNotebookRepository);

const mockTaskGroupRepository = (): TaskGroupRepository =>
  ({
    findByIds: vi.fn(),
  } as unknown as TaskGroupRepository);

describe("AnswerTaskNotebookSessionUseCase", () => {
  let sessionRepo: TaskNotebookSessionRepository;
  let taskRepo: TaskRepository;
  let notebookRepo: TaskNotebookRepository;
  let taskGroupRepo: TaskGroupRepository;
  let useCase: AnswerTaskNotebookSessionUseCase;

  beforeEach(() => {
    sessionRepo = mockSessionRepository();
    taskRepo = mockTaskRepository();
    notebookRepo = mockNotebookRepository();
    taskGroupRepo = mockTaskGroupRepository();

    useCase = new AnswerTaskNotebookSessionUseCase(
      sessionRepo,
      taskRepo,
      notebookRepo,
      taskGroupRepo
    );
  });

  it("should fail if session is not found", async () => {
    (sessionRepo.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      sessionId: ID.session,
      taskId: ID.task,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 10,
    });

    expect(result).toEqual(failure("SESSION_NOT_FOUND"));
  });

  it("should fail if session is already finished", async () => {
    const session = makeSession(ID.session, ID.notebook, true);

    (sessionRepo.getById as any).mockResolvedValue(session);

    const result = await useCase.execute({
      sessionId: ID.session,
      taskId: ID.task,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 10,
    });

    expect(result).toEqual(failure("SESSION_ALREADY_FINISHED"));
  });

  it("should fail if task is not found", async () => {
    const session = makeSession(ID.session, ID.notebook);

    (sessionRepo.getById as any).mockResolvedValue(session);
    (taskRepo.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      sessionId: ID.session,
      taskId: ID.task,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 10,
    });

    expect(result).toEqual(failure("TASK_NOT_FOUND"));
  });

  it("should fail if task is already answered", async () => {
    const session = {
      ...makeSession(ID.session, ID.notebook),
      answers: [
        {
          taskId: new Uuid(ID.task),
          selectedAlternativeId: new Uuid(ID.altWrong),
          isCorrect: false,
          answeredAt: new Date(),
          timeToAnswer: 5,
        },
      ],
    };

    (sessionRepo.getById as any).mockResolvedValue(session);

    (taskRepo.getById as any).mockResolvedValue(
      makeTask(ID.task, ID.altCorrect)
    );
    (notebookRepo.getById as any).mockResolvedValue(
      makeNotebook(ID.notebook, [ID.task])
    );

    const result = await useCase.execute({
      sessionId: ID.session,
      taskId: ID.task,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 10,
    });

    expect(result).toEqual(failure("TASK_ALREADY_ANSWERED"));
  });

  it("should answer the task successfully", async () => {
    const session = makeSession(ID.session, ID.notebook);

    (sessionRepo.getById as any).mockResolvedValue(session);
    (taskRepo.getById as any).mockResolvedValue(
      makeTask(ID.task, ID.altCorrect)
    );

    (notebookRepo.getById as any).mockResolvedValue(
      makeNotebook(ID.notebook, [ID.task])
    );

    const result = await useCase.execute({
      sessionId: ID.session,
      taskId: ID.task,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 12,
    });

    expect(result.ok).toBe(true);
    expect(sessionRepo.save).toHaveBeenCalled();

    const saved = (sessionRepo.save as any).mock.calls[0][0];

    expect(saved.answers.length).toBe(1);
    expect(saved.answers[0].isCorrect).toBe(true);
  });

  describe("session linked to a notebook", () => {
    const makeLinkedSession = (taskNotebookId?: Uuid) =>
      new TaskNotebookSession(
        new Uuid(ID.session),
        Uuid.random(),
        Uuid.random(),
        "sessao",
        new Date(),
        undefined,
        [],
        undefined,
        taskNotebookId
      );

    const answerRequest = {
      sessionId: ID.session,
      taskId: ID.task,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 8,
    };

    beforeEach(() => {
      (taskRepo.getById as any).mockResolvedValue(
        makeTask(ID.task, ID.altCorrect)
      );
    });

    it("should accept a task that is directly in the notebook", async () => {
      (sessionRepo.getById as any).mockResolvedValue(
        makeLinkedSession(new Uuid(ID.notebook))
      );
      (notebookRepo.getById as any).mockResolvedValue({
        ...makeNotebook(ID.notebook, [ID.task]),
        taskGroupsIds: [],
      });

      const result = await useCase.execute(answerRequest);

      expect(result.ok).toBe(true);
      expect(taskGroupRepo.findByIds).not.toHaveBeenCalled();
      const saved = (sessionRepo.save as any).mock.calls[0][0] as TaskNotebookSession;
      expect(saved.answers).toHaveLength(1);
      expect(saved.taskNotebookId?.value).toBe(ID.notebook);
    });

    it("should accept a task that belongs to a group of the notebook", async () => {
      const groupId = Uuid.random().value;
      (sessionRepo.getById as any).mockResolvedValue(
        makeLinkedSession(new Uuid(ID.notebook))
      );
      (notebookRepo.getById as any).mockResolvedValue({
        ...makeNotebook(ID.notebook, [Uuid.random().value]),
        taskGroupsIds: [groupId],
      });
      (taskGroupRepo.findByIds as any).mockResolvedValue([
        { id: new Uuid(groupId), tasksIds: [ID.task] },
      ]);

      const result = await useCase.execute(answerRequest);

      expect(result.ok).toBe(true);
      const ids = (taskGroupRepo.findByIds as any).mock.calls[0][0] as Uuid[];
      expect(ids.map((id) => id.value)).toEqual([groupId]);
      expect(sessionRepo.save).toHaveBeenCalled();
    });

    it("should return TASK_NOT_IN_NOTEBOOK when the task is outside the notebook", async () => {
      (sessionRepo.getById as any).mockResolvedValue(
        makeLinkedSession(new Uuid(ID.notebook))
      );
      (notebookRepo.getById as any).mockResolvedValue({
        ...makeNotebook(ID.notebook, [Uuid.random().value]),
        taskGroupsIds: [Uuid.random().value],
      });
      (taskGroupRepo.findByIds as any).mockResolvedValue([
        { id: Uuid.random(), tasksIds: [Uuid.random().value] },
      ]);

      const result = await useCase.execute(answerRequest);

      expect(result).toEqual({ ok: false, error: "TASK_NOT_IN_NOTEBOOK" });
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should return NOTEBOOK_NOT_FOUND when the notebook was deleted", async () => {
      (sessionRepo.getById as any).mockResolvedValue(
        makeLinkedSession(new Uuid(ID.notebook))
      );
      (notebookRepo.getById as any).mockResolvedValue(null);

      const result = await useCase.execute(answerRequest);

      expect(result).toEqual({ ok: false, error: "NOTEBOOK_NOT_FOUND" });
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should accept any task when the session has no notebook", async () => {
      (sessionRepo.getById as any).mockResolvedValue(makeLinkedSession());

      const result = await useCase.execute(answerRequest);

      expect(result.ok).toBe(true);
      expect(notebookRepo.getById).not.toHaveBeenCalled();
      expect(taskGroupRepo.findByIds).not.toHaveBeenCalled();
      expect(sessionRepo.save).toHaveBeenCalled();
    });
  });
});
