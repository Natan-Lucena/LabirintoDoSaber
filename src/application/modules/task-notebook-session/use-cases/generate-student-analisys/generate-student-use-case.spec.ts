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

// getById fica disponível (outros pontos do código ainda podem usá-lo),
// mas o use case sob teste deve usar getByIds em lote — os testes de
// regressão abaixo garantem isso e evitam a volta do N+1.
const mockTaskRepository = (): TaskRepository =>
  ({
    getById: vi.fn(),
    getByIds: vi.fn(),
  } as unknown as TaskRepository);

// Configura taskRepo.getByIds para resolver, a partir de um "catálogo" de
// tasks, exatamente as tasks correspondentes aos ids pedidos (como uma
// query real com `id: { in: [...] }` faria).
const stubTaskCatalog = (
  taskRepo: TaskRepository,
  catalog: Record<string, ReturnType<typeof makeTask>>
) => {
  (taskRepo.getByIds as any).mockImplementation(async (ids: Uuid[]) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.value)));
    return uniqueIds
      .map((id) => catalog[id])
      .filter((task): task is NonNullable<typeof task> => Boolean(task));
  });
};

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

    // sem respostas, não deve nem tentar buscar tasks
    expect(taskRepo.getByIds as any).not.toHaveBeenCalled();
  });

  it("should calculate accuracy correctly per category and total", async () => {
    (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));

    const session = makeSession([
      { taskId: ID.t1, isCorrect: true },  // reading
      { taskId: ID.t2, isCorrect: false }, // reading
      { taskId: ID.t3, isCorrect: true },  // writing
    ]);

    (sessionRepo.listByStudentId as any).mockResolvedValue([session]);

    stubTaskCatalog(taskRepo, {
      [ID.t1]: makeTask(ID.t1, TaskCategory.Reading),
      [ID.t2]: makeTask(ID.t2, TaskCategory.Reading),
      [ID.t3]: makeTask(ID.t3, TaskCategory.Writing),
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

    stubTaskCatalog(taskRepo, {
      [ID.t1]: makeTask(ID.t1, TaskCategory.Vocabulary),
      // ID.missing propositalmente ausente do catálogo
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

    stubTaskCatalog(taskRepo, {
      [ID.t1]: makeTask(ID.t1, TaskCategory.Reading),
      [ID.t2]: makeTask(ID.t2, TaskCategory.Reading),
      [ID.t3]: makeTask(ID.t3, TaskCategory.Comprehension),
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

  // --- regressão: consulta de tasks em lote (anti N+1) ----------
  //
  // Antes da correção, o use case chamava taskRepository.getById() uma vez
  // POR RESPOSTA, sequencialmente. Um aluno com 81 respostas gerava 81
  // round trips ao banco (~5s medidos contra o cluster real). Estes testes
  // travam o contrato correto: uma única chamada em lote, com ids únicos.
  describe("batched task lookup (anti N+1 regression)", () => {
    it("should fetch tasks with a single batched call, never per-answer getById", async () => {
      (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));

      // 20 respostas espalhadas em várias sessões
      const answers = Array.from({ length: 20 }, (_, i) => ({
        taskId: i % 2 === 0 ? ID.t1 : ID.t2,
        isCorrect: i % 3 === 0,
      }));
      const session1 = makeSession(answers.slice(0, 10));
      const session2 = makeSession(answers.slice(10));

      (sessionRepo.listByStudentId as any).mockResolvedValue([session1, session2]);

      stubTaskCatalog(taskRepo, {
        [ID.t1]: makeTask(ID.t1, TaskCategory.Reading),
        [ID.t2]: makeTask(ID.t2, TaskCategory.Writing),
      });

      const result = await useCase.execute({ studentId: ID.student });

      expect(result.ok).toBe(true);

      // exatamente 1 chamada em lote, independentemente de quantas respostas existam
      expect(taskRepo.getByIds as any).toHaveBeenCalledTimes(1);
      // getById (por item) nunca deve ser usado por este use case
      expect(taskRepo.getById as any).not.toHaveBeenCalled();
    });

    it("should request each referenced task id only once, even if many answers repeat it", async () => {
      (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));

      const answers = Array.from({ length: 15 }, () => ({
        taskId: ID.t1,
        isCorrect: true,
      }));
      (sessionRepo.listByStudentId as any).mockResolvedValue([
        makeSession(answers),
      ]);

      stubTaskCatalog(taskRepo, {
        [ID.t1]: makeTask(ID.t1, TaskCategory.Reading),
      });

      await useCase.execute({ studentId: ID.student });

      const calledWith = (taskRepo.getByIds as any).mock.calls[0][0] as Uuid[];
      const uniqueIds = new Set(calledWith.map((id) => id.value));

      expect(uniqueIds.size).toBe(1);
      expect(uniqueIds.has(ID.t1)).toBe(true);
    });

    it("should still compute correct per-category stats when fetched in a batch", async () => {
      (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));

      const answers = [
        { taskId: ID.t1, isCorrect: true },
        { taskId: ID.t1, isCorrect: false },
        { taskId: ID.t2, isCorrect: true },
      ];
      (sessionRepo.listByStudentId as any).mockResolvedValue([
        makeSession(answers),
      ]);

      stubTaskCatalog(taskRepo, {
        [ID.t1]: makeTask(ID.t1, TaskCategory.Reading),
        [ID.t2]: makeTask(ID.t2, TaskCategory.Writing),
      });

      const result = await useCase.execute({ studentId: ID.student });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected result to be ok");

      expect(result.value.categories.reading.total).toBe(2);
      expect(result.value.categories.reading.correct).toBe(1);
      expect(result.value.categories.writing.total).toBe(1);
      expect(result.value.categories.writing.correct).toBe(1);
      expect(taskRepo.getByIds as any).toHaveBeenCalledTimes(1);
    });
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

      stubTaskCatalog(taskRepo, {
        [ID.t1]: makeTask(ID.t1, TaskCategory.Reading),
        [ID.t2]: makeTask(ID.t2, TaskCategory.Reading),
        [ID.t3]: makeTask(ID.t3, TaskCategory.Reading),
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

      stubTaskCatalog(taskRepo, {
        [ID.t1]: makeTask(ID.t1, TaskCategory.Reading),
        [ID.t2]: makeTask(ID.t2, TaskCategory.Reading),
        [ID.t3]: makeTask(ID.t3, TaskCategory.Reading),
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

  // --- loadAnalysisData: reuso interno por outros use cases -----
  //
  // GenerateStudentAiAnalysisUseCase reaproveita loadAnalysisData() para
  // não refazer as mesmas buscas de student/tasks. execute() (o método
  // exposto ao controller HTTP) precisa continuar retornando só
  // categories/total/sessions — nunca student ou taskById, que carregam
  // dados sensíveis (student.educators[].password) sem lugar num response
  // JSON público.
  describe("loadAnalysisData (reuso interno)", () => {
    it("should expose student and taskById for internal callers to reuse", async () => {
      const student = makeStudent(ID.student);
      (studentRepo.getById as any).mockResolvedValue(student);

      const session = makeSession([{ taskId: ID.t1, isCorrect: true }]);
      (sessionRepo.listByStudentId as any).mockResolvedValue([session]);

      stubTaskCatalog(taskRepo, {
        [ID.t1]: makeTask(ID.t1, TaskCategory.Reading),
      });

      const raw = await useCase.loadAnalysisData({ studentId: ID.student });

      expect(raw.ok).toBe(true);
      if (!raw.ok) throw new Error("Expected result to be ok");

      expect(raw.value.student).toBe(student);
      expect(raw.value.taskById.get(ID.t1)?.category).toBe(
        TaskCategory.Reading,
      );
      // uma única chamada em lote, igual ao execute()
      expect(taskRepo.getByIds as any).toHaveBeenCalledTimes(1);
    });

    it("should propagate STUDENT_NOT_FOUND from loadAnalysisData", async () => {
      (studentRepo.getById as any).mockResolvedValue(null);

      const raw = await useCase.loadAnalysisData({ studentId: ID.student });

      expect(raw).toEqual(failure("STUDENT_NOT_FOUND"));
    });

    it("execute() should never leak student or taskById in its public response", async () => {
      (studentRepo.getById as any).mockResolvedValue(makeStudent(ID.student));

      const session = makeSession([{ taskId: ID.t1, isCorrect: true }]);
      (sessionRepo.listByStudentId as any).mockResolvedValue([session]);

      stubTaskCatalog(taskRepo, {
        [ID.t1]: makeTask(ID.t1, TaskCategory.Reading),
      });

      const result = await useCase.execute({ studentId: ID.student });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected result to be ok");

      expect(Object.keys(result.value).sort()).toEqual(
        ["categories", "sessions", "total"].sort(),
      );
      expect((result.value as any).student).toBeUndefined();
      expect((result.value as any).taskById).toBeUndefined();
    });
  });
});
