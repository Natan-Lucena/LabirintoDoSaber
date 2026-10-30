import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UpdateTaskNotebookUseCase } from "./update-task-notebook-use-case";
import {
  TaskNotebook,
  TaskNotebookCategory,
} from "../../../../../domain/entities/task-notebook";
import { Educator } from "../../../../../domain/entities/educator";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";

const makeEducator = () =>
  Educator.create({
    name: "Educadora",
    email: "educadora@example.com",
    password: "hash",
  });

const makeNotebook = (educator: Educator) => {
  const created = TaskNotebook.create({
    educator,
    category: TaskNotebookCategory.Reading,
    description: "Caderno original",
  });
  if (!created.ok) throw new Error("fixture inválida");
  return created.value;
};

describe("UpdateTaskNotebookUseCase", () => {
  let repository: TaskNotebookRepository;
  let useCase: UpdateTaskNotebookUseCase;
  const owner = makeEducator();

  beforeEach(() => {
    repository = {
      getById: vi.fn(),
      save: vi.fn(),
    } as unknown as TaskNotebookRepository;
    useCase = new UpdateTaskNotebookUseCase(repository);
  });

  it("atualiza o caderno quando o educador é o dono", async () => {
    const notebook = makeNotebook(owner);
    (repository.getById as any).mockResolvedValue(notebook);

    const result = await useCase.execute({
      taskNotebookId: notebook.id.value,
      educatorId: owner.id,
      description: "Descrição nova",
      category: TaskNotebookCategory.Writing,
    });

    expect(result).toEqual({ ok: true, value: undefined });
    const saved = (repository.save as any).mock.calls[0][0] as TaskNotebook;
    expect(saved.id.value).toBe(notebook.id.value);
    expect(saved.description).toBe("Descrição nova");
    expect(saved.category).toBe(TaskNotebookCategory.Writing);
    expect(saved.educator.id.value).toBe(owner.id.value);
  });

  it("devolve NOT_NOTEBOOK_OWNER sem salvar quando o caderno é de outro educador", async () => {
    const notebook = makeNotebook(makeEducator());
    (repository.getById as any).mockResolvedValue(notebook);

    const result = await useCase.execute({
      taskNotebookId: notebook.id.value,
      educatorId: owner.id,
      description: "Tentativa",
    });

    expect(result).toEqual({ ok: false, error: "NOT_NOTEBOOK_OWNER" });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("devolve TASK_NOTEBOOK_NOT_FOUND quando o caderno não existe", async () => {
    (repository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      taskNotebookId: Uuid.random().value,
      educatorId: owner.id,
    });

    expect(result).toEqual({ ok: false, error: "TASK_NOTEBOOK_NOT_FOUND" });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("devolve INVALID_TASK_NOTEBOOK_ID sem consultar o banco", async () => {
    const result = await useCase.execute({
      taskNotebookId: "id-invalido",
      educatorId: owner.id,
    });

    expect(result).toEqual({ ok: false, error: "INVALID_TASK_NOTEBOOK_ID" });
    expect(repository.getById).not.toHaveBeenCalled();
  });
});
