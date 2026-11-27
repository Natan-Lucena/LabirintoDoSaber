import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid, failure } from "@wave-telecom/framework/core";
import { TaskNotebookCategory } from "../../../../../domain/entities/task-notebook";
import {
  Task,
  TaskCategory,
  TaskType,
} from "../../../../../domain/entities/task";
import { Educator } from "../../../../../domain/entities/educator";
import { CreateTaskNotebookUseCase } from "./create-task-notebook-use-case";
import {
  makeLibraryTask,
  makePrintableTask,
  makeWordBuilderTask,
} from "../../../task/use-cases/test-fixtures";

const mockEducatorRepository = { getByEmail: vi.fn() };
// getById fica disponível (contrato legado), mas o use case sob teste deve
// usar getByIds em lote — os testes abaixo travam isso e evitam a volta do
// fan-out (um getById por task, via Promise.all).
const mockTaskRepository = {
  getById: vi.fn(),
  getByIds: vi.fn(),
  findLegacyOwners: vi.fn(),
};
const mockTaskNotebookRepository = { save: vi.fn() };

let useCase: CreateTaskNotebookUseCase;

// Configura taskRepository.getByIds para resolver, a partir de um
// "catálogo" de tasks, exatamente as tasks correspondentes aos ids
// pedidos (como uma query real com `id: { in: [...] }` faria).
const stubTaskCatalog = (catalog: Record<string, Task>) => {
  mockTaskRepository.getByIds.mockImplementation(async (ids: Uuid[]) => {
    const uniqueIds = Array.from(new Set(ids.map((id) => id.value)));
    return uniqueIds
      .map((id) => catalog[id])
      .filter((task): task is Task => Boolean(task));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTaskRepository.findLegacyOwners.mockResolvedValue(new Map());
  useCase = new CreateTaskNotebookUseCase(
    mockTaskNotebookRepository as any,
    mockEducatorRepository as any,
    mockTaskRepository as any
  );
});

const mockEducator = {
  id: Uuid.random(),
  name: "Maria",
  email: "maria@example.com",
};

const mockTaskResult = Task.create({
  category: TaskCategory.Reading,
  type: TaskType.MultipleChoice,
  prompt: "Qual é a capital da França?",
  alternatives: [
    { text: "Paris", isCorrect: true },
    { text: "Londres", isCorrect: false },
  ],
});

if (!mockTaskResult.ok) throw new Error("Mock task inválida");
const mockTask = mockTaskResult.value;

describe("CreateTaskNotebookUseCase", () => {
  it("should fail if educator does not exist", async () => {
    mockEducatorRepository.getByEmail.mockResolvedValue(null);

    const result = await useCase.execute({
      educatorEmail: "inexistente@example.com",
      tasks: [Uuid.random().toString()],
      category: TaskNotebookCategory.Reading,
      description: "Caderno de leitura inicial",
    });

    expect(result).toEqual(failure("EDUCATOR_DOES_NOT_EXISTS"));
  });

  it("should fail if no tasks exist", async () => {
    mockEducatorRepository.getByEmail.mockResolvedValue(mockEducator);
    stubTaskCatalog({});

    const result = await useCase.execute({
      educatorEmail: "maria@example.com",
      tasks: [Uuid.random().toString()],
      category: TaskNotebookCategory.Writing,
      description: "Caderno de escrita",
    });

    expect(result).toEqual(failure("TASKS_DOES_NOT_EXISTS"));
  });

  it("should fail if TaskNotebook.create fails", async () => {
    const { TaskNotebook } = await import(
      "../../../../../domain/entities/task-notebook"
    );
    const spy = vi
      .spyOn(TaskNotebook, "create")
      .mockReturnValue({ ok: false } as any);

    mockEducatorRepository.getByEmail.mockResolvedValue(mockEducator);
    stubTaskCatalog({ [mockTask.id.value]: mockTask });

    const result = await useCase.execute({
      educatorEmail: "maria@example.com",
      tasks: [mockTask.id.toString()],
      category: TaskNotebookCategory.Vocabulary,
      description: "Teste de falha no create",
    });

    expect(result).toEqual(failure("TASK_NOTEBOOK_CREATION_FAILED"));
    spy.mockRestore();
  });

  it("BE-AT-05: imprimível no caderno → PRINTABLE_NOT_PLAYABLE sem salvar", async () => {
    const printable = makePrintableTask();
    mockEducatorRepository.getByEmail.mockResolvedValue(mockEducator);
    stubTaskCatalog({ [mockTask.id.value]: mockTask, [printable.id.value]: printable });

    const result = await useCase.execute({
      educatorEmail: "maria@example.com",
      tasks: [mockTask.id.value, printable.id.value],
      category: TaskNotebookCategory.Reading,
      description: "Caderno com imprimível",
    });

    expect(result).toEqual(failure("PRINTABLE_NOT_PLAYABLE"));
    expect(mockTaskNotebookRepository.save).not.toHaveBeenCalled();
  });

  it("tarefa de outro educador ou antiga em caderno/grupo de outro → UNAUTHORIZED", async () => {
    const owner = Educator.create({ name: "Maria", email: "maria@example.com", password: "h" });
    mockEducatorRepository.getByEmail.mockResolvedValue(owner);
    const othersTask = makeWordBuilderTask({ educatorId: Uuid.random() });
    stubTaskCatalog({ [othersTask.id.value]: othersTask, [mockTask.id.value]: mockTask });

    expect(
      await useCase.execute({
        educatorEmail: "maria@example.com",
        tasks: [othersTask.id.value],
        category: TaskNotebookCategory.Writing,
        description: "Caderno",
      })
    ).toEqual(failure("UNAUTHORIZED"));

    mockTaskRepository.findLegacyOwners.mockResolvedValue(
      new Map([[mockTask.id.value, [Uuid.random().value]]])
    );
    expect(
      await useCase.execute({
        educatorEmail: "maria@example.com",
        tasks: [mockTask.id.value],
        category: TaskNotebookCategory.Reading,
        description: "Caderno",
      })
    ).toEqual(failure("UNAUTHORIZED"));
    expect(mockTaskNotebookRepository.save).not.toHaveBeenCalled();
  });

  it("aceita a própria, a antiga avulsa e a antiga já em caderno/grupo do educador", async () => {
    const owner = Educator.create({ name: "Maria", email: "maria@example.com", password: "h" });
    mockEducatorRepository.getByEmail.mockResolvedValue(owner);
    const own = makeWordBuilderTask({ educatorId: owner.id });
    const legacyMine = makeWordBuilderTask();
    stubTaskCatalog({
      [own.id.value]: own,
      [mockTask.id.value]: mockTask,
      [legacyMine.id.value]: legacyMine,
    });
    mockTaskRepository.findLegacyOwners.mockResolvedValue(
      new Map([
        [mockTask.id.value, []],
        [legacyMine.id.value, [owner.id.value]],
      ])
    );
    mockTaskNotebookRepository.save.mockImplementation(async (nb) => nb);

    const result = await useCase.execute({
      educatorEmail: "maria@example.com",
      tasks: [own.id.value, mockTask.id.value, legacyMine.id.value],
      category: TaskNotebookCategory.Writing,
      description: "Caderno",
    });

    expect(result.ok).toBe(true);
    // Uma busca só para os donos das duas antigas.
    expect(mockTaskRepository.findLegacyOwners).toHaveBeenCalledTimes(1);
    expect(mockTaskRepository.findLegacyOwners.mock.calls[0][0]).toHaveLength(2);
  });

  it("AT-10: aceita tarefa da biblioteca e de tipo novo", async () => {
    const library = makeLibraryTask();
    mockEducatorRepository.getByEmail.mockResolvedValue(
      Educator.create({ name: "Maria", email: "maria@example.com", password: "hash" })
    );
    stubTaskCatalog({ [library.id.value]: library });
    mockTaskNotebookRepository.save.mockImplementation(async (nb) => nb);

    const result = await useCase.execute({
      educatorEmail: "maria@example.com",
      tasks: [library.id.value],
      category: TaskNotebookCategory.Writing,
      description: "Caderno com jogo da biblioteca",
    });

    expect(result.ok).toBe(true);
    const saved = mockTaskNotebookRepository.save.mock.calls[0][0];
    expect(saved.tasks.map((task: Task) => task.id.value)).toEqual([library.id.value]);
  });

  it("should create and save a TaskNotebook successfully", async () => {
    mockEducatorRepository.getByEmail.mockResolvedValue(mockEducator);
    stubTaskCatalog({ [mockTask.id.value]: mockTask });
    mockTaskNotebookRepository.save.mockImplementation(async (nb) => nb);

    const result = await useCase.execute({
      educatorEmail: "maria@example.com",
      tasks: [mockTask.id.toString()],
      category: TaskNotebookCategory.Comprehension,
      description: "Caderno de compreensão",
    });

    expect(result).toBeDefined();
    if ("educator" in result) {
      if (!result.ok) {
        throw new Error("SHOULD BE OK");
      }
      expect(result.value.educator.name).toBe("Maria");
      expect(result.value.tasks.length).toBe(1);
      expect(result.value.tasks[0].prompt).toBe("Qual é a capital da França?");
    }
    expect(mockTaskNotebookRepository.save).toHaveBeenCalledOnce();
  });

  // --- regressão: consulta de tasks em lote (anti fan-out) -------
  //
  // Antes da correção, o use case disparava um Promise.all de
  // taskRepository.getById() por task pedida — fan-out concorrente em
  // vez de uma única busca em lote. Estes testes travam o contrato
  // correto.
  describe("batched task lookup (anti fan-out regression)", () => {
    it("should fetch tasks with a single batched call, never per-task getById", async () => {
      const taskId2Result = Task.create({
        category: TaskCategory.Writing,
        type: TaskType.MultipleChoice,
        prompt: "Outra pergunta",
        alternatives: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
      });
      if (!taskId2Result.ok) throw new Error("Mock task inválida");
      const mockTask2 = taskId2Result.value;

      mockEducatorRepository.getByEmail.mockResolvedValue(mockEducator);
      stubTaskCatalog({
        [mockTask.id.value]: mockTask,
        [mockTask2.id.value]: mockTask2,
      });
      mockTaskNotebookRepository.save.mockImplementation(async (nb) => nb);

      await useCase.execute({
        educatorEmail: "maria@example.com",
        tasks: [mockTask.id.value, mockTask2.id.value],
        category: TaskNotebookCategory.Reading,
        description: "Caderno com duas tasks",
      });

      expect(mockTaskRepository.getByIds).toHaveBeenCalledTimes(1);
      expect(mockTaskRepository.getById).not.toHaveBeenCalled();
    });

    it("should preserve the original task order when resolving from the batch", async () => {
      mockEducatorRepository.getByEmail.mockResolvedValue(mockEducator);
      // apenas mockTask existe; o primeiro id pedido é o inexistente
      const missingId = Uuid.random().value;
      stubTaskCatalog({ [mockTask.id.value]: mockTask });

      const result = await useCase.execute({
        educatorEmail: "maria@example.com",
        tasks: [missingId, mockTask.id.value],
        category: TaskNotebookCategory.Reading,
        description: "Caderno com id inexistente primeiro",
      });

      // mantém o comportamento existente: falha se a PRIMEIRA task pedida
      // não existir, mesmo que outra exista.
      expect(result).toEqual(failure("TASKS_DOES_NOT_EXISTS"));
    });
  });
});
