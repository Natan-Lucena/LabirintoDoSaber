import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeneratorReportTaskNotebookSessionUseCase } from "./generator-report-task-notebook-session-use-case";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { success, failure, Uuid } from "@wave-telecom/framework/core";
import { Task } from "../../../../../domain/entities/task";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
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

const EDUCATOR_ID = Uuid.random();
const STUDENT = makeStudent(EDUCATOR_ID);
const COLLEAGUE = Educator.create({ name: "Bia", email: "bia@mail.com", password: "hash" });

// --- Factories e Mocks ---

// Factory para criar uma resposta mockada
const makeAnswer = ({
  taskId = Uuid.random(),
  isCorrect = true,
  timeToAnswer = 10, // milissegundos
} = {}) => ({
  taskId,
  isCorrect,
  timeToAnswer,
});

// Factory para criar uma sessão mockada
const makeSession = ({
  id = Uuid.random().value,
  answers = [makeAnswer(), makeAnswer({ isCorrect: false, timeToAnswer: 5 })],
  finishedAt = new Date(new Date().getTime() + 60000), // 60 segundos após startedAt
  startedAt = new Date(),
  educatorId = EDUCATOR_ID,
} = {}) => {
  const session = {
    id: new Uuid(id),
    studentId: STUDENT.id,
    educatorId,
    answers,
    startedAt,
    finishedAt,
  };

  return session;
};

// Mock do repositório de sessão
const mockSessionRepository = (): TaskNotebookSessionRepository =>
  ({
    getById: vi.fn(),
  }) as unknown as TaskNotebookSessionRepository;

// getById fica disponível (contrato legado), mas o use case sob teste deve
// usar getByIds em lote — os testes abaixo travam isso e evitam a volta do
// N+1 (um getById por resposta, mesmo repetindo a mesma task).
const mockTaskRepository = (): TaskRepository =>
  ({
    getById: vi.fn(),
    getByIds: vi.fn(),
  }) as unknown as TaskRepository;

// Factory para criar uma tarefa mockada
const makeTask = ({
  id = Uuid.random(),
  category = "MATH",
  type = "MULTIPLE_CHOICE",
} = {}) =>
  ({
    id,
    category,
    type,
    // Outras propriedades de Task, se necessário
  }) as unknown as Task;

// Configura taskRepository.getByIds para resolver, a partir de um
// "catálogo" de tasks, exatamente as tasks correspondentes aos ids
// pedidos (como uma query real com `id: { in: [...] }` faria).
const stubTaskCatalog = (
  taskRepository: TaskRepository,
  catalog: Record<string, Task>,
) => {
  (taskRepository.getByIds as any).mockImplementation(async (ids: Uuid[]) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.value)));
    return uniqueIds
      .map((id) => catalog[id])
      .filter((task): task is Task => Boolean(task));
  });
};

// --- Testes ---

describe("GeneratorReportTaskNotebookSessionUseCase", () => {
  let sessionRepository: TaskNotebookSessionRepository;
  let taskRepository: TaskRepository;
  let evolutionRepository: SessionEvolutionRepository;
  let activityResultRepository: ActivityResultRepository;
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let educatorRepository: EducatorRepository;
  let useCase: GeneratorReportTaskNotebookSessionUseCase;

  beforeEach(() => {
    sessionRepository = mockSessionRepository();
    taskRepository = mockTaskRepository();
    evolutionRepository = {
      findBySessionId: vi.fn().mockResolvedValue(null),
    } as unknown as SessionEvolutionRepository;
    activityResultRepository = {
      listBySessionId: vi.fn().mockResolvedValue([]),
    } as unknown as ActivityResultRepository;
    shareRepository = makeShareRepository();
    educatorRepository = {
      getByIds: vi.fn(async (ids: Uuid[]) =>
        ids.some((id) => id.value === COLLEAGUE.id.value) ? [COLLEAGUE] : []
      ),
    } as unknown as EducatorRepository;
    const studentRepository = {
      getById: vi.fn().mockResolvedValue(STUDENT),
    } as unknown as StudentRepository;
    useCase = new GeneratorReportTaskNotebookSessionUseCase(
      sessionRepository,
      makeStudentAccess(studentRepository, shareRepository),
      taskRepository,
      evolutionRepository,
      activityResultRepository,
      educatorRepository,
    );
  });

  it("should return the evolutionId of the session when there is one (EV-11)", async () => {
    const session = makeSession({ answers: [] });
    (sessionRepository.getById as any).mockResolvedValue(session);
    const evolutionId = Uuid.random();
    (evolutionRepository.findBySessionId as any).mockResolvedValue({ id: evolutionId });

    const result = await useCase.execute({ sessionId: session.id.value, educatorId: EDUCATOR_ID });

    expect(result.ok).toBe(true);
    expect((result as any).value.evolutionId).toBe(evolutionId.value);
    expect(evolutionRepository.findBySessionId).toHaveBeenCalledWith(session.id);
  });

  it("should leave evolutionId absent when the session has no evolution", async () => {
    (sessionRepository.getById as any).mockResolvedValue(makeSession({ answers: [] }));

    const result = await useCase.execute({ sessionId: Uuid.random().value, educatorId: EDUCATOR_ID });

    expect(result.ok).toBe(true);
    expect((result as any).value.evolutionId).toBeUndefined();
  });

  describe("activity results (RS-05, RS-07)", () => {
    const makeResult = (sessionId: Uuid, completed: boolean, correct: boolean) => {
      const created = ActivityResult.create({
        sessionId,
        task: makeWordBuilderTask(),
        completed,
        correct,
        attempts: 2,
        errors: 1,
        durationMs: 5000,
      });
      if (!created.ok) throw new Error(String(created.error));
      return created.value;
    };

    it("should add activitySummary and activityResults without changing the accuracy", async () => {
      const taskId = Uuid.random();
      const session = makeSession({
        answers: [
          makeAnswer({ taskId, isCorrect: true }),
          makeAnswer({ taskId, isCorrect: false }),
        ],
      });
      (sessionRepository.getById as any).mockResolvedValue(session);
      stubTaskCatalog(taskRepository, {
        [taskId.value]: makeTask({ id: taskId, category: "reading", type: "multipleChoice" }),
      });
      const results = [
        makeResult(session.id, true, true),
        makeResult(session.id, true, true),
        makeResult(session.id, false, false),
      ];
      (activityResultRepository.listBySessionId as any).mockResolvedValue(results);

      const result = await useCase.execute({ sessionId: session.id.value, educatorId: EDUCATOR_ID });

      expect(activityResultRepository.listBySessionId).toHaveBeenCalledWith(session.id);
      const report = (result as any).value;
      expect(report.activitySummary).toEqual({ total: 3, completed: 2, correct: 2 });
      expect(report.activityResults).toEqual(
        results.map((item) => ({
          id: item.id.value,
          sessionId: session.id.value,
          taskId: item.taskId.value,
          taskType: "wordBuilder",
          completed: item.completed,
          correct: item.correct,
          attempts: 2,
          errors: 1,
          durationMs: 5000,
          recordedAt: item.recordedAt,
        }))
      );
      // Resultados de jogo não entram no accuracy (RS-05).
      expect(report.totalQuestions).toBe(2);
      expect(report.percentageByCategory).toEqual({ reading: 50 });
      expect(report.percentageByType).toEqual({ multipleChoice: 50 });
    });
  });

  it("should return null averages, never NaN, for a session with only games", async () => {
    const session = makeSession({ answers: [] });
    (sessionRepository.getById as any).mockResolvedValue(session);
    const created = ActivityResult.create({
      sessionId: session.id,
      task: makeWordBuilderTask(),
      completed: true,
      correct: true,
      attempts: 1,
      errors: 0,
      durationMs: 9000,
    });
    if (!created.ok) throw new Error(String(created.error));
    (activityResultRepository.listBySessionId as any).mockResolvedValue([created.value]);

    const report = ((await useCase.execute({ sessionId: session.id.value, educatorId: EDUCATOR_ID })) as any).value;

    expect(report.totalQuestions).toBe(0);
    expect(report.averageTimePerQuestion).toBeNull();
    expect(report.averageCorrectTime).toBeNull();
    expect(report.averageIncorrectTime).toBeNull();
    expect(JSON.parse(JSON.stringify(report)).averageTimePerQuestion).toBeNull();
    expect(report.activitySummary).toEqual({ total: 1, completed: 1, correct: 1 });
  });

  describe("access and authorship (RS-08, EQ-11, EQ-12)", () => {
    it("should return UNAUTHORIZED for an educator without access to the student", async () => {
      (sessionRepository.getById as any).mockResolvedValue(makeSession({ answers: [] }));

      const result = await useCase.execute({
        sessionId: Uuid.random().value,
        educatorId: Uuid.random(),
      });

      expect(result).toEqual(failure("UNAUTHORIZED"));
      expect(evolutionRepository.findBySessionId).not.toHaveBeenCalled();
    });

    it("should return SESSION_NOT_FOUND for an id that is not a UUID", async () => {
      const result = await useCase.execute({ sessionId: "abc", educatorId: EDUCATOR_ID });

      expect(result).toEqual(failure("SESSION_NOT_FOUND"));
    });

    it("should give the report to a shared educator, with the author's name", async () => {
      shareRepository.store.push(shareStudent(STUDENT, COLLEAGUE.id));
      (sessionRepository.getById as any).mockResolvedValue(makeSession({ answers: [] }));
      const ownerName = "Ana Dona";
      (educatorRepository.getByIds as any).mockResolvedValue([
        Educator.create({ name: ownerName, email: "ana@mail.com", password: "hash", id: EDUCATOR_ID }),
      ]);

      const result = await useCase.execute({
        sessionId: Uuid.random().value,
        educatorId: COLLEAGUE.id,
      });

      expect(result.ok).toBe(true);
      expect((result as any).value.authorName).toBe(ownerName);
    });

    it("should leave authorName absent when the reader conducted the session", async () => {
      (sessionRepository.getById as any).mockResolvedValue(makeSession({ answers: [] }));

      const result = await useCase.execute({
        sessionId: Uuid.random().value,
        educatorId: EDUCATOR_ID,
      });

      expect(result.ok).toBe(true);
      expect((result as any).value.authorName).toBeUndefined();
      expect(JSON.parse(JSON.stringify((result as any).value))).not.toHaveProperty("authorName");
    });
  });

  it("should fail if session does not exist", async () => {
    (sessionRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({ sessionId: Uuid.random().value, educatorId: EDUCATOR_ID });

    expect(result).toEqual(failure("SESSION_NOT_FOUND"));
    expect(taskRepository.getByIds).not.toHaveBeenCalled();
  });

  it("should generate report successfully for a simple session", async () => {
    const taskId1 = Uuid.random();
    const taskId2 = Uuid.random();
    const startTime = new Date(1672531200000); // 2023-01-01 00:00:00
    const finishTime = new Date(startTime.getTime() + 100000); // +100 segundos

    const answers = [
      makeAnswer({ taskId: taskId1, isCorrect: true, timeToAnswer: 15 }),
      makeAnswer({ taskId: taskId2, isCorrect: false, timeToAnswer: 25 }),
      makeAnswer({ taskId: taskId1, isCorrect: true, timeToAnswer: 10 }),
    ];

    const session = makeSession({
      answers,
      startedAt: startTime,
      finishedAt: finishTime,
    });
    (sessionRepository.getById as any).mockResolvedValue(session);

    const task1 = makeTask({
      id: taskId1,
      category: "Category A",
      type: "Type X",
    });
    const task2 = makeTask({
      id: taskId2,
      category: "Category B",
      type: "Type Y",
    });

    stubTaskCatalog(taskRepository, {
      [taskId1.value]: task1,
      [taskId2.value]: task2,
    });

    const result = await useCase.execute({ sessionId: Uuid.random().value, educatorId: EDUCATOR_ID });

    const expectedTotalTimeSession = 100;
    const expectedTotalQuestions = 3;
    const expectedAverageTimePerQuestion = 50 / 3;
    const expectedAverageCorrectTime = 12.5;
    const expectedAverageIncorrectTime = 25;

    const expectedPercentageByCategory = {
      "Category A": 100,
      "Category B": 0,
    };

    const expectedPercentageByType = {
      "Type X": 100,
      "Type Y": 0,
    };

    const expectedSuccess = success({
      totalTimeSession: expectedTotalTimeSession,
      totalQuestions: expectedTotalQuestions,
      averageTimePerQuestion: expectedAverageTimePerQuestion,
      averageCorrectTime: expectedAverageCorrectTime,
      averageIncorrectTime: expectedAverageIncorrectTime,
      percentageByCategory: expectedPercentageByCategory,
      percentageByType: expectedPercentageByType,
      observation: null,
      sessionName: undefined,
      activitySummary: { total: 0, completed: 0, correct: 0 },
      activityResults: [],
    });

    expect(result).toEqual(expectedSuccess);
  });

  it("should handle session with zero answers (empty arrays/null averages)", async () => {
    const startTime = new Date(1672531200000);
    const finishTime = new Date(startTime.getTime() + 50000); // 50 segundos

    const session = makeSession({
      answers: [],
      startedAt: startTime,
      finishedAt: finishTime,
    });
    (sessionRepository.getById as any).mockResolvedValue(session);

    const result = await useCase.execute({ sessionId: Uuid.random().value, educatorId: EDUCATOR_ID });

    const expectedTotalTimeSession = 50;
    const expectedTotalQuestions = 0;

    // Sem respostas não há média: null explícito, nunca NaN.
    const expectedAverageTimePerQuestion = null;
    const expectedAverageCorrectTime = null;
    const expectedAverageIncorrectTime = null;

    const expectedSuccess = success({
      totalTimeSession: expectedTotalTimeSession,
      totalQuestions: expectedTotalQuestions,
      averageTimePerQuestion: expectedAverageTimePerQuestion,
      averageCorrectTime: expectedAverageCorrectTime,
      averageIncorrectTime: expectedAverageIncorrectTime,
      percentageByCategory: {},
      percentageByType: {},
      observation: null,
      sessionName: undefined,
      activitySummary: { total: 0, completed: 0, correct: 0 },
      activityResults: [],
    });

    expect(result).toEqual(expectedSuccess);
    // sem respostas, não deve nem tentar buscar tasks
    expect(taskRepository.getByIds).not.toHaveBeenCalled();
  });

  it("should handle tasks not found for some answers gracefully", async () => {
    const taskId1 = Uuid.random(); // Task found
    const taskId2 = Uuid.random(); // Task NOT found

    const answers = [
      makeAnswer({ taskId: taskId1, isCorrect: true, timeToAnswer: 10 }), // Task found, Correct
      makeAnswer({ taskId: taskId2, isCorrect: false, timeToAnswer: 20 }), // Task NOT found, Incorrect
    ];

    const session = makeSession({ answers });
    (sessionRepository.getById as any).mockResolvedValue(session);

    const task1 = makeTask({
      id: taskId1,
      category: "Test Category",
      type: "Test Type",
    });

    // task1 está no catálogo; task2 propositalmente ausente (não encontrada)
    stubTaskCatalog(taskRepository, {
      [taskId1.value]: task1,
    });

    const result = await useCase.execute({ sessionId: Uuid.random().value, educatorId: EDUCATOR_ID });

    const expectedTotalQuestions = 2;
    const expectedAverageTimePerQuestion = 15;
    const expectedAverageCorrectTime = 10;
    const expectedAverageIncorrectTime = 20;

    // Apenas taskId1 será contada nas estatísticas de categoria/tipo
    const expectedPercentageByCategory = {
      "Test Category": 100,
    };

    const expectedPercentageByType = {
      "Test Type": 100,
    };

    // Para facilitar a comparação em objetos grandes, usamos expect.objectContaining
    // e verificamos o sucesso no topo.
    expect(result.ok).toBe(true);
    expect(result).toEqual(
      success(
        expect.objectContaining({
          totalQuestions: expectedTotalQuestions,
          averageTimePerQuestion: expectedAverageTimePerQuestion,
          averageCorrectTime: expectedAverageCorrectTime,
          averageIncorrectTime: expectedAverageIncorrectTime,
          percentageByCategory: expectedPercentageByCategory,
          percentageByType: expectedPercentageByType,
        }),
      ),
    );
  });

  // --- regressão: consulta de tasks em lote (anti N+1) ----------
  //
  // Antes da correção, o use case chamava taskRepository.getById() uma vez
  // POR RESPOSTA, sequencialmente — mesma task repetida em várias respostas
  // gerava uma chamada por resposta, não por task única. Estes testes
  // travam o contrato correto: uma única chamada em lote, com ids únicos.
  describe("batched task lookup (anti N+1 regression)", () => {
    it("should fetch tasks with a single batched call, never per-answer getById", async () => {
      const taskId1 = Uuid.random();
      const taskId2 = Uuid.random();

      const answers = [
        makeAnswer({ taskId: taskId1 }),
        makeAnswer({ taskId: taskId2 }),
        makeAnswer({ taskId: taskId1 }),
      ];
      const session = makeSession({ answers });
      (sessionRepository.getById as any).mockResolvedValue(session);

      stubTaskCatalog(taskRepository, {
        [taskId1.value]: makeTask({ id: taskId1 }),
        [taskId2.value]: makeTask({ id: taskId2 }),
      });

      await useCase.execute({ sessionId: Uuid.random().value, educatorId: EDUCATOR_ID });

      expect(taskRepository.getByIds).toHaveBeenCalledTimes(1);
      expect(taskRepository.getById).not.toHaveBeenCalled();
    });

    it("should request each referenced task id only once, even if repeated across answers", async () => {
      const taskId1 = Uuid.random();

      const answers = [
        makeAnswer({ taskId: taskId1 }),
        makeAnswer({ taskId: taskId1 }),
        makeAnswer({ taskId: taskId1 }),
      ];
      const session = makeSession({ answers });
      (sessionRepository.getById as any).mockResolvedValue(session);

      stubTaskCatalog(taskRepository, {
        [taskId1.value]: makeTask({ id: taskId1 }),
      });

      await useCase.execute({ sessionId: Uuid.random().value, educatorId: EDUCATOR_ID });

      const calledWith = (taskRepository.getByIds as any).mock
        .calls[0][0] as Uuid[];
      const uniqueIds = new Set(calledWith.map((id) => id.value));

      expect(uniqueIds.size).toBe(1);
      expect(uniqueIds.has(taskId1.value)).toBe(true);
    });
  });
});
