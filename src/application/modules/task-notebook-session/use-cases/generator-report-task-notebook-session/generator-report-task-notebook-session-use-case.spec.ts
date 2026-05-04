import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeneratorReportTaskNotebookSessionUseCase } from "./generator-report-task-notebook-session-use-case";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { success, failure, Uuid } from "@wave-telecom/framework/core";
import { Task } from "../../../../../domain/entities/task";

// --- Factories e Mocks ---

// Factory para criar uma resposta mockada
const makeAnswer = ({
  taskId = Uuid.random(),
  isCorrect = true,
  timeToAnswer = 10, // segundos
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
} = {}) => {
  const session = {
    id: new Uuid(id),
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

// Mock do repositório de tarefa
const mockTaskRepository = (): TaskRepository =>
  ({
    getById: vi.fn(),
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

// --- Testes ---

describe("GeneratorReportTaskNotebookSessionUseCase", () => {
  let sessionRepository: TaskNotebookSessionRepository;
  let taskRepository: TaskRepository;
  let useCase: GeneratorReportTaskNotebookSessionUseCase;

  beforeEach(() => {
    sessionRepository = mockSessionRepository();
    taskRepository = mockTaskRepository();
    useCase = new GeneratorReportTaskNotebookSessionUseCase(
      sessionRepository,
      taskRepository,
    );
  });

  it("should fail if session does not exist", async () => {
    (sessionRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({ sessionId: Uuid.random().value });

    expect(result).toEqual(failure("SESSION_NOT_FOUND"));
    expect(taskRepository.getById).not.toHaveBeenCalled();
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

    // Mock do getById: comparando pela propriedade .value
    (taskRepository.getById as any).mockImplementation((taskId: Uuid) => {
      if (taskId.value === taskId1.value) return Promise.resolve(task1);
      if (taskId.value === taskId2.value) return Promise.resolve(task2);
      return Promise.resolve(null);
    });

    const result = await useCase.execute({ sessionId: Uuid.random().value });

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
    });

    expect(result).toEqual(expectedSuccess);
    expect(taskRepository.getById).toHaveBeenCalledTimes(3);
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

    (taskRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({ sessionId: Uuid.random().value });

    const expectedTotalTimeSession = 50;
    const expectedTotalQuestions = 0;

    const expectedAverageTimePerQuestion = NaN;
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
    });

    expect(result).toEqual(expectedSuccess);
    expect(taskRepository.getById).not.toHaveBeenCalled();
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

    // Mock: task1 é encontrado, task2 não é (retorna null)
    (taskRepository.getById as any).mockImplementation((taskId: Uuid) => {
      if (taskId.value === taskId1.value) return Promise.resolve(task1);
      if (taskId.value === taskId2.value) return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const result = await useCase.execute({ sessionId: Uuid.random().value });

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

    expect(taskRepository.getById).toHaveBeenCalledTimes(2);
  });
});
