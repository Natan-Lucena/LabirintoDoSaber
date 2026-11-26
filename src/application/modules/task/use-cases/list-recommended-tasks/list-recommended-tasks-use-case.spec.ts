import { describe, it, expect, beforeEach, vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Task, TaskCategory, TaskSource } from "../../../../../domain/entities/task";
import { Gender, Student } from "../../../../../domain/entities/student";
import {
  TaskAnswer,
  TaskNotebookSession,
} from "../../../../../domain/entities/task-notebook-session";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { ListRecommendedTasksUseCase } from "./list-recommended-tasks-use-case";
import {
  makeMultipleChoiceTask,
  makeSkillRepository,
  makeTaskRepository,
  makeWordBuilderTask,
} from "../test-fixtures";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";

const makeStudent = (educatorId: Uuid, learningTopics: string[]) =>
  Student.create({
    name: "Aluno Fixture",
    age: 8,
    gender: Gender.Female,
    zipcode: "00000000",
    road: "Rua",
    housenumber: "1",
    phonenumber: "11999999999",
    learningTopics,
    educators: [],
    educatorId,
  });

const answer = (task: Task, isCorrect: boolean): TaskAnswer => ({
  taskId: task.id,
  selectedAlternativeId: Uuid.random(),
  isCorrect,
  timeToAnswer: 1000,
  answeredAt: new Date(),
});

const session = (studentId: Uuid, educatorId: Uuid, day: number, answers: TaskAnswer[]) =>
  new TaskNotebookSession(
    Uuid.random(),
    studentId,
    educatorId,
    "Sessão",
    new Date(Date.UTC(2026, 10, day, 13)),
    new Date(Date.UTC(2026, 10, day, 14)),
    answers
  );

describe("ListRecommendedTasksUseCase (AT-08)", () => {
  const educatorId = Uuid.random();
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let studentRepository: { getById: ReturnType<typeof vi.fn> };
  let sessionRepository: { listByStudentId: ReturnType<typeof vi.fn> };
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let useCase: ListRecommendedTasksUseCase;

  beforeEach(() => {
    taskRepository = makeTaskRepository();
    studentRepository = { getById: vi.fn() };
    sessionRepository = { listByStudentId: vi.fn().mockResolvedValue([]) };
    shareRepository = makeShareRepository();
    useCase = new ListRecommendedTasksUseCase(
      makeStudentAccess(studentRepository as unknown as StudentRepository, shareRepository),
      sessionRepository as unknown as TaskNotebookSessionRepository,
      taskRepository,
      makeSkillRepository()
    );
  });

  const recommendedIds = (result: Awaited<ReturnType<ListRecommendedTasksUseCase["execute"]>>) => {
    if (!result.ok) throw new Error(`falhou: ${result.error}`);
    return result.value.map((item) => item.id);
  };

  it("STUDENT_NOT_FOUND quando o aluno não existe", async () => {
    studentRepository.getById.mockResolvedValue(null);
    expect(await useCase.execute({ educatorId, studentId: Uuid.random().value })).toEqual({
      ok: false,
      error: "STUDENT_NOT_FOUND",
    });
  });

  it("BE-AT-04: aluno de outro educador → UNAUTHORIZED", async () => {
    const student = makeStudent(Uuid.random(), ["alfabetização"]);
    studentRepository.getById.mockResolvedValue(student);

    expect(await useCase.execute({ educatorId, studentId: student.id.value })).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(taskRepository.listLibrary).not.toHaveBeenCalled();
  });

  it("EQ-11: aluno compartilhado com o educador → recomenda com as tarefas dele", async () => {
    const student = makeStudent(Uuid.random(), ["alfabetização"]);
    shareRepository.store.push(shareStudent(student, educatorId));
    studentRepository.getById.mockResolvedValue(student);

    const result = await useCase.execute({ educatorId, studentId: student.id.value });

    expect(result.ok).toBe(true);
    expect(taskRepository.listByEducator).toHaveBeenCalledWith(educatorId);
  });

  it("BE-AT-04: sem sessões recomenda pelas learningTopics (sem acento/maiúscula)", async () => {
    const student = makeStudent(educatorId, ["ALFABETIZACAO"]);
    studentRepository.getById.mockResolvedValue(student);
    const phonology = makeWordBuilderTask({
      source: TaskSource.Library,
      skills: ["CONSCIENCIA_FONOLOGICA"],
    });
    const unrelated = makeWordBuilderTask({ source: TaskSource.Library, skills: ["ATENCAO_VISUAL"] });
    taskRepository.listLibrary.mockResolvedValue([phonology, unrelated]);

    const result = await useCase.execute({ educatorId, studentId: student.id.value });

    expect(recommendedIds(result)).toEqual([phonology.id.value]);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({
      id: phonology.id.value,
      source: "LIBRARY",
      skills: [{ code: "CONSCIENCIA_FONOLOGICA", label: "Consciência fonológica" }],
    });
    expect(result.value[0].reason).toContain("Consciência fonológica");
    expect(result.value[0].reason).not.toContain("Aluno Fixture");
  });

  it("casa o tópico do catálogo como palavra dentro do tema do aluno", async () => {
    const student = makeStudent(educatorId, ["Dificuldade de linguagem"]);
    studentRepository.getById.mockResolvedValue(student);
    const vocabulary = makeWordBuilderTask({ source: TaskSource.Library, skills: ["VOCABULARIO"] });
    taskRepository.listLibrary.mockResolvedValue([vocabulary]);

    const result = await useCase.execute({ educatorId, studentId: student.id.value });

    expect(recommendedIds(result)).toEqual([vocabulary.id.value]);
  });

  it("sem temas e sem sessões não recomenda nada", async () => {
    const student = makeStudent(educatorId, []);
    studentRepository.getById.mockResolvedValue(student);
    taskRepository.listLibrary.mockResolvedValue([makeWordBuilderTask({ source: TaskSource.Library })]);

    expect(await useCase.execute({ educatorId, studentId: student.id.value })).toEqual({
      ok: true,
      value: [],
    });
  });

  it("usa a categoria de menor acerto das últimas 5 sessões e não repete as das 3 últimas", async () => {
    const student = makeStudent(educatorId, []);
    studentRepository.getById.mockResolvedValue(student);

    const readingDone = makeMultipleChoiceTask({ educatorId, category: TaskCategory.Reading });
    const writingDone = makeWordBuilderTask({ educatorId, category: TaskCategory.Writing });
    const readingOld = makeMultipleChoiceTask({ educatorId, category: TaskCategory.Reading });
    const readingNew = makeMultipleChoiceTask({ educatorId, category: TaskCategory.Reading });
    const writingNew = makeWordBuilderTask({ educatorId, category: TaskCategory.Writing });
    const vocabulary = makeMultipleChoiceTask({ educatorId, category: TaskCategory.Vocabulary });

    // Leitura: 1 de 4 nas últimas 5. Escrita: 2 de 2. A sessão 1 (6ª mais
    // recente) tem vocabulário com 0% e não entra na conta.
    sessionRepository.listByStudentId.mockResolvedValue([
      session(student.id, educatorId, 1, [answer(vocabulary, false)]),
      session(student.id, educatorId, 2, [answer(readingOld, false)]),
      session(student.id, educatorId, 3, []),
      session(student.id, educatorId, 4, [answer(readingDone, true)]),
      session(student.id, educatorId, 6, [answer(writingDone, true), answer(readingDone, false)]),
      session(student.id, educatorId, 5, [answer(writingDone, true), answer(readingOld, false)]),
    ]);
    taskRepository.getByIds.mockImplementation(async (ids: Uuid[]) =>
      [readingDone, writingDone, readingOld, vocabulary].filter((task) =>
        ids.some((id) => id.value === task.id.value)
      )
    );
    taskRepository.listByEducator.mockResolvedValue([
      readingDone,
      writingDone,
      readingOld,
      readingNew,
      writingNew,
      vocabulary,
    ]);

    const result = await useCase.execute({ educatorId, studentId: student.id.value });

    // readingDone e readingOld foram respondidas nas 3 últimas (dias 4, 5, 6).
    expect(recommendedIds(result)).toEqual([readingNew.id.value]);
    if (result.ok) expect(result.value[0].reason).toMatch(/leitura/i);
  });

  it("no máximo 6, quem casa com tema e categoria primeiro, reason até 120", async () => {
    const student = makeStudent(educatorId, ["linguagem", "TDAH"]);
    studentRepository.getById.mockResolvedValue(student);
    const done = makeMultipleChoiceTask({ educatorId, category: TaskCategory.Writing });
    sessionRepository.listByStudentId.mockResolvedValue([
      session(student.id, educatorId, 1, [answer(done, false)]),
    ]);
    taskRepository.getByIds.mockResolvedValue([done]);

    const both = makeWordBuilderTask({
      source: TaskSource.Library,
      category: TaskCategory.Writing,
      skills: ["VOCABULARIO", "ATENCAO_VISUAL"],
      createdAt: new Date("2026-01-01"),
    });
    const many = Array.from({ length: 8 }, (_, index) =>
      makeWordBuilderTask({
        source: TaskSource.Library,
        category: TaskCategory.Reading,
        skills: ["VOCABULARIO"],
        createdAt: new Date(Date.UTC(2026, 5, index + 1)),
      })
    );
    taskRepository.listLibrary.mockResolvedValue([...many, both]);

    const result = await useCase.execute({ educatorId, studentId: student.id.value });

    if (!result.ok) throw new Error("falhou");
    expect(result.value).toHaveLength(6);
    expect(result.value[0].id).toBe(both.id.value);
    for (const item of result.value) {
      expect(item.reason.length).toBeGreaterThan(0);
      expect(item.reason.length).toBeLessThanOrEqual(120);
    }
  });
});
