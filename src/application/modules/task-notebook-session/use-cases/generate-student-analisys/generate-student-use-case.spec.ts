import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";

import { TaskCategory } from "../../../../../domain/entities/task";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { GenerateStudentAnalysisUseCase } from "./generate-student-analisys-use-case";

// IDs fixos
const ID = {
  student: Uuid.random().value,
  session1: Uuid.random().value,
  session2: Uuid.random().value,
  session3: Uuid.random().value,
  t1: Uuid.random().value,
  t2: Uuid.random().value,
  t3: Uuid.random().value,
  missing: Uuid.random().value,
};

// Factories --------------------------------------------------

const makeStudent = (studentId: string) => ({
  id: new Uuid(studentId),
});

const makeSession = (
  answers: Array<{ taskId: string; isCorrect: boolean }>,
  startedAt: Date = new Date()
) => ({
  id: Uuid.random(),
  startedAt,
  answers: answers.map((a) => ({
    taskId: new Uuid(a.taskId),
    selectedAlternativeId: Uuid.random(),
    isCorrect: a.isCorrect,
    timeToAnswer: 1,
    answeredAt: new Date(),
  })),
});

const makeTask = (taskId: string, category: TaskCategory) => ({
  id: new Uuid(taskId),
  category,
});

// Repositórios mockados ------------------------------------------
const mockStudentRepository = (): StudentRepository =>
  ({
    getById: vi.fn(),
  } as unknown as StudentRepository);

const mockSessionRepository = (): TaskNotebookSessionRepository =>
  ({
    listByStudentId: vi.fn(),
  } as unknown as TaskNotebookSessionRepository);

const mockTaskRepository = (): TaskRepository =>
  ({
    getById: vi.fn(),
  } as unknown as TaskRepository);

// Tests ----------------------------------------------------------
describe("GenerateStudentAnalysisUseCase", () => {
  let studentRepo: StudentRepository;
  let sessionRepo: TaskNotebookSessionRepository;
  let taskRepo: TaskRepository;
  let useCase: GenerateStudentAnalysisUseCase;

  beforeEach(() => {
    studentRepo = mockStudentRepository();
    sessionRepo = mockSessionRepository();
    taskRepo = mockTaskRepository();

    useCase = new GenerateStudentAnalysisUseCase(
      studentRepo,
      sessionRepo,
      taskRepo,
    );
  });

  // --- cenários base -------------------------------------------

  it("should fail if student is not found", async () => {
    (studentRepo.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({ studentId: ID.student });

    expect(result).toEqual(failure("STUDENT_NOT_FOUND"));
  });

  it("should return zeros when student has no sessions", async () => {
    (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));
    (sessionRepo.listByStudentId as any).mockResolvedValue([]);

    const result = await useCase.execute({ studentId: ID.student });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected result to be ok");

    const { total, categories } = result.value;

    expect(total).toEqual({ total: 0, correct: 0, accuracy: 0 });
    expect(categories.reading.total).toBe(0);
    expect(categories.writing.total).toBe(0);
    expect(categories.vocabulary.total).toBe(0);
    expect(categories.comprehension.total).toBe(0);
  });

  it("should calculate accuracy correctly per category and total", async () => {
    (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));

    const session = makeSession([
      { taskId: ID.t1, isCorrect: true },  // reading
      { taskId: ID.t2, isCorrect: false }, // reading
      { taskId: ID.t3, isCorrect: true },  // writing
    ]);

    (sessionRepo.listByStudentId as any).mockResolvedValue([session]);

    (taskRepo.getById as any).mockImplementation((taskId: Uuid | any) => {
      const id = (taskId as any).value ?? taskId;
      if (id === ID.t1) return makeTask(ID.t1, TaskCategory.Reading);
      if (id === ID.t2) return makeTask(ID.t2, TaskCategory.Reading);
      if (id === ID.t3) return makeTask(ID.t3, TaskCategory.Writing);
      return null;
    });

    const result = await useCase.execute({ studentId: ID.student });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected result to be ok");

    const { categories, total } = result.value;

    expect(categories.reading.total).toBe(2);
    expect(categories.reading.correct).toBe(1);
    expect(categories.reading.accuracy).toBe(0.5);

    expect(categories.writing.total).toBe(1);
    expect(categories.writing.correct).toBe(1);
    expect(categories.writing.accuracy).toBe(1);

    expect(total.total).toBe(3);
    expect(total.correct).toBe(2);
    expect(total.accuracy).toBeCloseTo(2 / 3);
  });

  it("should ignore answers whose tasks do not exist", async () => {
    (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));

    const session = makeSession([
      { taskId: ID.t1, isCorrect: true },
      { taskId: ID.missing, isCorrect: true }, // task inexistente
    ]);

    (sessionRepo.listByStudentId as any).mockResolvedValue([session]);

    (taskRepo.getById as any).mockImplementation((taskId: Uuid | any) => {
      const id = (taskId as any).value ?? taskId;
      if (id === ID.t1) return makeTask(ID.t1, TaskCategory.Vocabulary);
      return null;
    });

    const result = await useCase.execute({ studentId: ID.student });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected result to be ok");

    const { categories, total } = result.value;

    expect(categories.vocabulary.total).toBe(1);
    expect(categories.vocabulary.correct).toBe(1);
    expect(total.total).toBe(1);
    expect(total.correct).toBe(1);
  });

  it("should sum multiple sessions correctly", async () => {
    (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));

    const session1 = makeSession([{ taskId: ID.t1, isCorrect: true }]);
    const session2 = makeSession([
      { taskId: ID.t2, isCorrect: false },
      { taskId: ID.t3, isCorrect: true },
    ]);

    (sessionRepo.listByStudentId as any).mockResolvedValue([session1, session2]);

    (taskRepo.getById as any).mockImplementation((taskId: Uuid | any) => {
      const id = (taskId as any).value ?? taskId;
      if (id === ID.t1 || id === ID.t2) return makeTask(id, TaskCategory.Reading);
      if (id === ID.t3) return makeTask(id, TaskCategory.Comprehension);
      return null;
    });

    const result = await useCase.execute({ studentId: ID.student });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected result to be ok");

    const { categories, total } = result.value;

    expect(categories.reading.total).toBe(2);
    expect(categories.reading.correct).toBe(1);
    expect(categories.comprehension.total).toBe(1);
    expect(categories.comprehension.correct).toBe(1);
    expect(total.total).toBe(3);
    expect(total.correct).toBe(2);
  });

  // --- filtro por limit ----------------------------------------

  describe("limit filter", () => {
    const old   = new Date("2026-01-01T10:00:00Z");
    const mid   = new Date("2026-03-01T10:00:00Z");
    const recent = new Date("2026-05-01T10:00:00Z");

    beforeEach(() => {
      (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));

      // session1 = mais antiga, session2 = intermediária, session3 = mais recente
      const session1 = makeSession([{ taskId: ID.t1, isCorrect: true }], old);
      const session2 = makeSession([{ taskId: ID.t2, isCorrect: true }], mid);
      const session3 = makeSession([{ taskId: ID.t3, isCorrect: false }], recent);

      (sessionRepo.listByStudentId as any).mockResolvedValue([
        session1,
        session2,
        session3,
      ]);

      (taskRepo.getById as any).mockImplementation((taskId: Uuid | any) => {
        const id = (taskId as any).value ?? taskId;
        return makeTask(id, TaskCategory.Reading);
      });
    });

    it("should consider only the N most recent sessions when limit is given", async () => {
      const result = await useCase.execute({ studentId: ID.student, limit: 2 });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected result to be ok");

      const { total, sessions } = result.value;

      // apenas session2 (mid) e session3 (recent)
      expect(sessions).toHaveLength(2);
      expect(total.total).toBe(2);
      // t2 correto, t3 incorreto
      expect(total.correct).toBe(1);
      expect(total.accuracy).toBe(0.5);
    });

    it("should return all sessions when limit exceeds total count", async () => {
      const result = await useCase.execute({ studentId: ID.student, limit: 10 });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected result to be ok");

      expect(result.value.sessions).toHaveLength(3);
      expect(result.value.total.total).toBe(3);
    });

    it("should return zeros when limit is given but no sessions exist", async () => {
      (sessionRepo.listByStudentId as any).mockResolvedValue([]);

      const result = await useCase.execute({ studentId: ID.student, limit: 5 });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected result to be ok");

      expect(result.value.total).toEqual({ total: 0, correct: 0, accuracy: 0 });
    });
  });

  // --- filtro por janela de datas ------------------------------

  describe("date window filter", () => {
    const jan = new Date("2026-01-15T10:00:00Z");
    const mar = new Date("2026-03-15T10:00:00Z");
    const may = new Date("2026-05-15T10:00:00Z");

    beforeEach(() => {
      (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));

      const sessionJan = makeSession([{ taskId: ID.t1, isCorrect: true }], jan);
      const sessionMar = makeSession([{ taskId: ID.t2, isCorrect: true }], mar);
      const sessionMay = makeSession([{ taskId: ID.t3, isCorrect: false }], may);

      (sessionRepo.listByStudentId as any).mockResolvedValue([
        sessionJan,
        sessionMar,
        sessionMay,
      ]);

      (taskRepo.getById as any).mockImplementation((taskId: Uuid | any) => {
        const id = (taskId as any).value ?? taskId;
        return makeTask(id, TaskCategory.Reading);
      });
    });

    it("should filter sessions by startDate (inclusive)", async () => {
      const result = await useCase.execute({
        studentId: ID.student,
        startDate: new Date("2026-03-01T00:00:00Z"),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected result to be ok");

      const { sessions, total } = result.value;

      // apenas março e maio passam
      expect(sessions).toHaveLength(2);
      expect(total.total).toBe(2);
      expect(total.correct).toBe(1); // t2 correto, t3 incorreto
    });

    it("should filter sessions by endDate (inclusive)", async () => {
      const result = await useCase.execute({
        studentId: ID.student,
        endDate: new Date("2026-03-31T23:59:59Z"),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected result to be ok");

      const { sessions, total } = result.value;

      // apenas janeiro e março passam
      expect(sessions).toHaveLength(2);
      expect(total.total).toBe(2);
      expect(total.correct).toBe(2); // t1 e t2 corretos
    });

    it("should filter sessions by startDate and endDate window", async () => {
      const result = await useCase.execute({
        studentId: ID.student,
        startDate: new Date("2026-02-01T00:00:00Z"),
        endDate: new Date("2026-04-30T23:59:59Z"),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected result to be ok");

      const { sessions, total } = result.value;

      // apenas março passa
      expect(sessions).toHaveLength(1);
      expect(total.total).toBe(1);
      expect(total.correct).toBe(1);
    });

    it("should return zeros when no sessions fall within the date window", async () => {
      const result = await useCase.execute({
        studentId: ID.student,
        startDate: new Date("2025-01-01T00:00:00Z"),
        endDate: new Date("2025-12-31T23:59:59Z"),
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected result to be ok");

      expect(result.value.sessions).toHaveLength(0);
      expect(result.value.total).toEqual({ total: 0, correct: 0, accuracy: 0 });
    });
  });
});
