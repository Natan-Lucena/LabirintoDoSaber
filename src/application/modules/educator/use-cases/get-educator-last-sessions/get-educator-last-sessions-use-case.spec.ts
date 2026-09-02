import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { GetEducatorLastSessionsUseCase } from "./get-educator-last-sessions-use-case";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";

const mockEducatorRepository = (): EducatorRepository =>
  ({ getByEmail: vi.fn() } as unknown as EducatorRepository);

const mockSessionRepository = (): TaskNotebookSessionRepository =>
  ({ listByEducatorId: vi.fn() } as unknown as TaskNotebookSessionRepository);

// getById fica disponível (contrato legado), mas o use case sob teste deve
// usar getByIds em lote — os testes abaixo travam isso e evitam a volta do
// fan-out (um getById por sessão, via Promise.all).
const mockStudentRepository = (): StudentRepository =>
  ({
    getById: vi.fn(),
    getByIds: vi.fn(),
  } as unknown as StudentRepository);

const stubStudentCatalog = (
  studentRepository: StudentRepository,
  catalog: Record<string, { name: string }>
) => {
  (studentRepository.getByIds as any).mockImplementation(
    async (ids: Uuid[]) => {
      const uniqueIds = Array.from(new Set(ids.map((id) => id.value)));
      return uniqueIds
        .filter((id) => Boolean(catalog[id]))
        .map((id) => ({ id: new Uuid(id), ...catalog[id] }));
    }
  );
};

const makeSession = (studentId: Uuid, name: string) => ({
  studentId,
  name,
});

describe("GetEducatorLastSessionsUseCase", () => {
  let educatorRepository: EducatorRepository;
  let sessionRepository: TaskNotebookSessionRepository;
  let studentRepository: StudentRepository;
  let useCase: GetEducatorLastSessionsUseCase;

  beforeEach(() => {
    educatorRepository = mockEducatorRepository();
    sessionRepository = mockSessionRepository();
    studentRepository = mockStudentRepository();
    useCase = new GetEducatorLastSessionsUseCase(
      educatorRepository,
      sessionRepository,
      studentRepository
    );
  });

  it("should fail if educator does not exist", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue(null);

    const result = await useCase.execute({
      educatorEmail: "inexistente@example.com",
    });

    expect(result).toEqual(failure("EDUCATOR_NOT_FOUND"));
  });

  it("should fail if educator has no sessions", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue({
      id: Uuid.random(),
    });
    (sessionRepository.listByEducatorId as any).mockResolvedValue([]);

    const result = await useCase.execute({
      educatorEmail: "prof@example.com",
    });

    expect(result).toEqual(failure("EDUCATOR_DOES_NOT_HAVE_SESSIONS"));
    expect(studentRepository.getByIds as any).not.toHaveBeenCalled();
  });

  it("should return the student name for each of the educator's last sessions", async () => {
    const studentId1 = Uuid.random();
    const studentId2 = Uuid.random();

    (educatorRepository.getByEmail as any).mockResolvedValue({
      id: Uuid.random(),
    });
    (sessionRepository.listByEducatorId as any).mockResolvedValue([
      makeSession(studentId1, "Sessão 1"),
      makeSession(studentId2, "Sessão 2"),
    ]);
    stubStudentCatalog(studentRepository, {
      [studentId1.value]: { name: "Ana" },
      [studentId2.value]: { name: "Beto" },
    });

    const result = await useCase.execute({ educatorEmail: "prof@example.com" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected result to be ok");

    expect(result.value).toEqual([
      { studentName: "Ana", sessionName: "Sessão 1" },
      { studentName: "Beto", sessionName: "Sessão 2" },
    ]);
  });

  it("should leave studentName undefined when the student no longer exists", async () => {
    const studentId = Uuid.random();

    (educatorRepository.getByEmail as any).mockResolvedValue({
      id: Uuid.random(),
    });
    (sessionRepository.listByEducatorId as any).mockResolvedValue([
      makeSession(studentId, "Sessão 1"),
    ]);
    stubStudentCatalog(studentRepository, {});

    const result = await useCase.execute({ educatorEmail: "prof@example.com" });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected result to be ok");

    expect(result.value).toEqual([
      { studentName: undefined, sessionName: "Sessão 1" },
    ]);
  });

  // --- regressão: consulta de alunos em lote (anti fan-out) -----
  //
  // Antes da correção, o use case disparava um Promise.all de
  // studentRepository.getById() por sessão — fan-out concorrente em vez
  // de uma única busca em lote. Estes testes travam o contrato correto.
  describe("batched student lookup (anti fan-out regression)", () => {
    it("should fetch students with a single batched call, never per-session getById", async () => {
      const studentId1 = Uuid.random();
      const studentId2 = Uuid.random();

      (educatorRepository.getByEmail as any).mockResolvedValue({
        id: Uuid.random(),
      });
      (sessionRepository.listByEducatorId as any).mockResolvedValue([
        makeSession(studentId1, "Sessão 1"),
        makeSession(studentId2, "Sessão 2"),
      ]);
      stubStudentCatalog(studentRepository, {
        [studentId1.value]: { name: "Ana" },
        [studentId2.value]: { name: "Beto" },
      });

      await useCase.execute({ educatorEmail: "prof@example.com" });

      expect(studentRepository.getByIds as any).toHaveBeenCalledTimes(1);
      expect(studentRepository.getById as any).not.toHaveBeenCalled();
    });

    it("should request each referenced student id only once, even if repeated across sessions", async () => {
      const sharedStudentId = Uuid.random();

      (educatorRepository.getByEmail as any).mockResolvedValue({
        id: Uuid.random(),
      });
      (sessionRepository.listByEducatorId as any).mockResolvedValue([
        makeSession(sharedStudentId, "Sessão 1"),
        makeSession(sharedStudentId, "Sessão 2"),
      ]);
      stubStudentCatalog(studentRepository, {
        [sharedStudentId.value]: { name: "Ana" },
      });

      await useCase.execute({ educatorEmail: "prof@example.com" });

      const calledWith = (studentRepository.getByIds as any).mock
        .calls[0][0] as Uuid[];
      const uniqueIds = new Set(calledWith.map((id) => id.value));

      expect(uniqueIds.size).toBe(1);
      expect(uniqueIds.has(sharedStudentId.value)).toBe(true);
    });
  });
});
