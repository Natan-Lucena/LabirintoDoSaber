import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { ListTasksNotebooksUseCase } from "./list-tasks-notebooks-use-case";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import {
  TaskNotebook,
  TaskNotebookCategory,
} from "../../../../../domain/entities/task-notebook";
import { TaskGroup } from "../../../../../domain/entities/task-group";
import { TaskCategory } from "../../../../../domain/entities/task";
import { Educator } from "../../../../../domain/entities/educator";

// Fixtures --------------------------------------------------------

const makeEducator = () =>
  Educator.create({
    id: Uuid.random(),
    name: "Educador",
    email: "educador@example.com",
    password: "hash",
    createdAt: new Date(),
  });

const makeNotebook = (taskGroupsIds: string[]) => {
  const result = TaskNotebook.create({
    educator: makeEducator(),
    category: TaskNotebookCategory.Reading,
    description: "Caderno",
    taskGroupsIds,
  });
  if (!result.ok) throw new Error("fixture inválida");
  return result.value;
};

const makeGroup = (id: string) =>
  TaskGroup.create({
    id: new Uuid(id),
    name: "Grupo",
    educatorId: Uuid.random(),
    category: TaskCategory.Reading,
  });

// Repositórios mockados --------------------------------------------

const mockTaskNotebookRepository = (): TaskNotebookRepository =>
  ({
    search: vi.fn(),
  } as unknown as TaskNotebookRepository);

// findById fica disponível (contrato legado), mas o use case sob teste
// deve usar findByIds em lote — os testes abaixo travam isso e evitam a
// volta do fan-out N x M (um findById por grupo, por caderno).
const mockTaskGroupRepository = (): TaskGroupRepository =>
  ({
    findById: vi.fn(),
    findByIds: vi.fn(),
  } as unknown as TaskGroupRepository);

const stubGroupCatalog = (
  taskGroupRepo: TaskGroupRepository,
  catalog: Record<string, ReturnType<typeof makeGroup>>
) => {
  (taskGroupRepo.findByIds as any).mockImplementation(async (ids: Uuid[]) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.value)));
    return uniqueIds
      .map((id) => catalog[id])
      .filter((group): group is NonNullable<typeof group> => Boolean(group));
  });
};

// Tests -------------------------------------------------------------

describe("ListTasksNotebooksUseCase", () => {
  let taskNotebookRepository: TaskNotebookRepository;
  let taskGroupRepository: TaskGroupRepository;
  let useCase: ListTasksNotebooksUseCase;

  beforeEach(() => {
    taskNotebookRepository = mockTaskNotebookRepository();
    taskGroupRepository = mockTaskGroupRepository();
    useCase = new ListTasksNotebooksUseCase(
      taskNotebookRepository,
      taskGroupRepository
    );
  });

  it("should return notebooks with their task groups resolved", async () => {
    const groupId = Uuid.random().value;
    const notebook = makeNotebook([groupId]);

    (taskNotebookRepository.search as any).mockResolvedValue([notebook]);
    stubGroupCatalog(taskGroupRepository, { [groupId]: makeGroup(groupId) });

    const result = await useCase.execute({});

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected result to be ok");

    expect(result.value).toHaveLength(1);
    expect(result.value[0].notebook.id).toBe(notebook.id.value);
    expect(result.value[0].taskGroups).toHaveLength(1);
    expect(result.value[0].taskGroups[0]!.id.value).toBe(groupId);
  });

  it("should return an empty list when there are no notebooks", async () => {
    (taskNotebookRepository.search as any).mockResolvedValue([]);

    const result = await useCase.execute({});

    expect(result).toEqual({ ok: true, value: [] });
    // sem cadernos, não deve nem tentar buscar grupos
    expect(taskGroupRepository.findByIds as any).not.toHaveBeenCalled();
  });

  it("should filter out task groups that no longer exist", async () => {
    const existingId = Uuid.random().value;
    const missingId = Uuid.random().value;
    const notebook = makeNotebook([existingId, missingId]);

    (taskNotebookRepository.search as any).mockResolvedValue([notebook]);
    stubGroupCatalog(taskGroupRepository, {
      [existingId]: makeGroup(existingId),
      // missingId propositalmente ausente do catálogo
    });

    const result = await useCase.execute({});

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected result to be ok");

    expect(result.value[0].taskGroups).toHaveLength(1);
    expect(result.value[0].taskGroups[0]!.id.value).toBe(existingId);
  });

  it("should return failure if the notebook repository throws", async () => {
    (taskNotebookRepository.search as any).mockRejectedValue(
      new Error("DB error")
    );

    const result = await useCase.execute({});

    expect(result).toEqual(failure("LIST_TASKS_NOTEBOOKS_FAILED"));
  });

  // --- regressão: consulta de grupos em lote (anti N+1 / anti fan-out) ---
  //
  // Antes da correção, o use case fazia um Promise.all de
  // taskGroupRepository.findById() para CADA grupo de CADA caderno — um
  // fan-out N x M de round trips concorrentes. Medido contra o cluster
  // real: 13 cadernos / 15 grupos referenciados geraram 15 chamadas
  // concorrentes e ~800ms de wall time, com queries individuais
  // degradando por contenção de conexão. Estes testes travam o contrato
  // correto: uma única chamada em lote, com ids únicos.
  describe("batched task group lookup (anti fan-out regression)", () => {
    it("should fetch task groups with a single batched call, never per-group findById", async () => {
      const groupA = Uuid.random().value;
      const groupB = Uuid.random().value;
      const groupC = Uuid.random().value;

      const notebooks = [
        makeNotebook([groupA, groupB]),
        makeNotebook([groupC]),
        makeNotebook([]),
      ];

      (taskNotebookRepository.search as any).mockResolvedValue(notebooks);
      stubGroupCatalog(taskGroupRepository, {
        [groupA]: makeGroup(groupA),
        [groupB]: makeGroup(groupB),
        [groupC]: makeGroup(groupC),
      });

      const result = await useCase.execute({});

      expect(result.ok).toBe(true);
      expect(taskGroupRepository.findByIds as any).toHaveBeenCalledTimes(1);
      expect(taskGroupRepository.findById as any).not.toHaveBeenCalled();
    });

    it("should request each referenced group id only once, even if repeated across notebooks", async () => {
      const sharedGroupId = Uuid.random().value;
      const notebooks = [
        makeNotebook([sharedGroupId]),
        makeNotebook([sharedGroupId]),
        makeNotebook([sharedGroupId]),
      ];

      (taskNotebookRepository.search as any).mockResolvedValue(notebooks);
      stubGroupCatalog(taskGroupRepository, {
        [sharedGroupId]: makeGroup(sharedGroupId),
      });

      await useCase.execute({});

      const calledWith = (taskGroupRepository.findByIds as any).mock
        .calls[0][0] as Uuid[];
      const uniqueIds = new Set(calledWith.map((id) => id.value));

      expect(uniqueIds.size).toBe(1);
      expect(uniqueIds.has(sharedGroupId)).toBe(true);
    });

    it("should correctly map each notebook to only its own task groups", async () => {
      const groupA = Uuid.random().value;
      const groupB = Uuid.random().value;

      const notebookA = makeNotebook([groupA]);
      const notebookB = makeNotebook([groupB]);

      (taskNotebookRepository.search as any).mockResolvedValue([
        notebookA,
        notebookB,
      ]);
      stubGroupCatalog(taskGroupRepository, {
        [groupA]: makeGroup(groupA),
        [groupB]: makeGroup(groupB),
      });

      const result = await useCase.execute({});

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("Expected result to be ok");

      const byNotebookId = new Map(
        result.value.map((r) => [r.notebook.id, r.taskGroups])
      );

      expect(byNotebookId.get(notebookA.id.value)![0]!.id.value).toBe(groupA);
      expect(byNotebookId.get(notebookB.id.value)![0]!.id.value).toBe(groupB);
    });
  });
});
