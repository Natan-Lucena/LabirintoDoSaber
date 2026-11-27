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
import { TaskType } from "../../../../../domain/entities/task";
import {
  makeMultipleChoiceTask,
  makePrintableTask,
  makeWordBuilderTask,
} from "../../../task/use-cases/test-fixtures";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";

const EDUCATOR_ID = Uuid.random();
const STUDENT = makeStudent(EDUCATOR_ID);

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
    studentId: STUDENT.id,
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
  type: TaskType.MultipleChoice,
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
    findLegacyOwners: vi.fn().mockResolvedValue(new Map()),
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
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let useCase: AnswerTaskNotebookSessionUseCase;

  beforeEach(() => {
    sessionRepo = mockSessionRepository();
    taskRepo = mockTaskRepository();
    notebookRepo = mockNotebookRepository();
    taskGroupRepo = mockTaskGroupRepository();
    shareRepository = makeShareRepository();
    const studentRepo = {
      getById: vi.fn().mockResolvedValue(STUDENT),
    } as unknown as StudentRepository;

    useCase = new AnswerTaskNotebookSessionUseCase(
      sessionRepo,
      makeStudentAccess(studentRepo, shareRepository),
      taskRepo,
      notebookRepo,
      taskGroupRepo
    );
  });

  it("should fail if session is not found", async () => {
    (sessionRepo.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      educatorId: EDUCATOR_ID,
      sessionId: ID.session,
      taskId: ID.task,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 10,
    });

    expect(result).toEqual(failure("SESSION_NOT_FOUND"));
  });

  it("should return SESSION_NOT_FOUND for an id that is not a UUID", async () => {
    const result = await useCase.execute({
      educatorId: EDUCATOR_ID,
      sessionId: "abc",
      taskId: ID.task,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 10,
    });

    expect(result).toEqual(failure("SESSION_NOT_FOUND"));
  });

  describe("access to the student (RS-08, EQ-11)", () => {
    const answerAs = (educatorId: Uuid) =>
      useCase.execute({
        educatorId,
        sessionId: ID.session,
        taskId: ID.task,
        selectedAlternativeId: ID.altCorrect,
        timeToAnswer: 10,
      });

    beforeEach(() => {
      // Sessão sem caderno: a atividade só precisa ser utilizável pelo educador.
      (sessionRepo.getById as any).mockResolvedValue(makeSession(ID.session, ID.notebook));
    });

    it("should return UNAUTHORIZED for an educator without access to the student", async () => {
      const result = await answerAs(Uuid.random());

      expect(result).toEqual(failure("UNAUTHORIZED"));
      expect(taskRepo.getById).not.toHaveBeenCalled();
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should let an educator the student is shared with answer", async () => {
      const colleagueId = Uuid.random();
      shareRepository.store.push(shareStudent(STUDENT, colleagueId));
      const task = makeMultipleChoiceTask({ educatorId: colleagueId });
      (taskRepo.getById as any).mockResolvedValue(task);

      const result = await useCase.execute({
        educatorId: colleagueId,
        sessionId: ID.session,
        taskId: task.id.value,
        selectedAlternativeId: task.alternatives[0].id!.value,
        timeToAnswer: 10,
      });

      expect(result.ok).toBe(true);
      expect(sessionRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  it("should fail if session is already finished", async () => {
    const session = makeSession(ID.session, ID.notebook, true);

    (sessionRepo.getById as any).mockResolvedValue(session);

    const result = await useCase.execute({
      educatorId: EDUCATOR_ID,
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
      educatorId: EDUCATOR_ID,
      sessionId: ID.session,
      taskId: ID.task,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 10,
    });

    expect(result).toEqual(failure("TASK_NOT_FOUND"));
  });

  it("AT-10: imprimível não é respondido na sessão → PRINTABLE_NOT_PLAYABLE", async () => {
    const session = makeSession(ID.session, ID.notebook);
    const printable = makePrintableTask();

    (sessionRepo.getById as any).mockResolvedValue(session);
    (taskRepo.getById as any).mockResolvedValue(printable);

    const result = await useCase.execute({
      educatorId: EDUCATOR_ID,
      sessionId: ID.session,
      taskId: printable.id.value,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 10,
    });

    expect(result).toEqual(failure("PRINTABLE_NOT_PLAYABLE"));
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it("RS-03: tipo jogável novo usa a rota de resultado → USE_ACTIVITY_RESULT_ROUTE", async () => {
    const session = makeSession(ID.session, ID.notebook);
    const playable = makeWordBuilderTask();

    (sessionRepo.getById as any).mockResolvedValue(session);
    (taskRepo.getById as any).mockResolvedValue(playable);

    const result = await useCase.execute({
      educatorId: EDUCATOR_ID,
      sessionId: ID.session,
      taskId: playable.id.value,
      selectedAlternativeId: ID.altCorrect,
      timeToAnswer: 10,
    });

    expect(result).toEqual(failure("USE_ACTIVITY_RESULT_ROUTE"));
    expect(notebookRepo.getById).not.toHaveBeenCalled();
    expect(sessionRepo.save).not.toHaveBeenCalled();
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
      educatorId: EDUCATOR_ID,
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
      educatorId: EDUCATOR_ID,
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

  describe("session without a notebook: only tasks the educator can use", () => {
    const freeSession = () =>
      new TaskNotebookSession(
        new Uuid(ID.session),
        Uuid.random(),
        Uuid.random(),
        "sessao",
        new Date()
      );

    const answerTask = (taskId: string, alternativeId: string) =>
      useCase.execute({
        educatorId: EDUCATOR_ID,
        sessionId: ID.session,
        taskId,
        selectedAlternativeId: alternativeId,
        timeToAnswer: 8,
      });

    beforeEach(() => {
      (sessionRepo.getById as any).mockResolvedValue(freeSession());
    });

    it("should return UNAUTHORIZED for a task of another educator", async () => {
      const foreign = makeMultipleChoiceTask({ educatorId: Uuid.random() });
      (taskRepo.getById as any).mockResolvedValue(foreign);

      const result = await answerTask(foreign.id.value, foreign.alternatives[0].id!.value);

      expect(result).toEqual(failure("UNAUTHORIZED"));
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should return UNAUTHORIZED for a legacy task owned by other educators", async () => {
      const legacy = makeMultipleChoiceTask();
      (taskRepo.getById as any).mockResolvedValue(legacy);
      (taskRepo.findLegacyOwners as any).mockResolvedValue(
        new Map([[legacy.id.value, [Uuid.random().value]]])
      );

      const result = await answerTask(legacy.id.value, legacy.alternatives[0].id!.value);

      expect(result).toEqual(failure("UNAUTHORIZED"));
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should accept the educator's own task", async () => {
      const own = makeMultipleChoiceTask({ educatorId: EDUCATOR_ID });
      (taskRepo.getById as any).mockResolvedValue(own);

      const result = await answerTask(own.id.value, own.alternatives[0].id!.value);

      expect(result.ok).toBe(true);
      expect(sessionRepo.save).toHaveBeenCalled();
    });
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
      educatorId: EDUCATOR_ID,
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
