import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { DeleteTaskNotebookUseCase } from "./delete-task-notebook-use-case";
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
    description: "Caderno",
  });
  if (!created.ok) throw new Error("fixture inválida");
  return created.value;
};

describe("DeleteTaskNotebookUseCase", () => {
  let repository: TaskNotebookRepository;
  let useCase: DeleteTaskNotebookUseCase;
  const owner = makeEducator();

  beforeEach(() => {
    repository = {
      getById: vi.fn(),
      delete: vi.fn(),
    } as unknown as TaskNotebookRepository;
    useCase = new DeleteTaskNotebookUseCase(repository);
  });

  it("exclui o caderno quando o educador é o dono", async () => {
    const notebook = makeNotebook(owner);
    (repository.getById as any).mockResolvedValue(notebook);

    const result = await useCase.execute({
      taskNotebookId: notebook.id,
      educatorId: owner.id,
    });

    expect(result).toEqual({ ok: true, value: null });
    expect(repository.delete).toHaveBeenCalledWith(notebook.id);
  });

  it("devolve NOT_NOTEBOOK_OWNER sem excluir quando o caderno é de outro educador", async () => {
    const notebook = makeNotebook(makeEducator());
    (repository.getById as any).mockResolvedValue(notebook);

    const result = await useCase.execute({
      taskNotebookId: notebook.id,
      educatorId: owner.id,
    });

    expect(result).toEqual({ ok: false, error: "NOT_NOTEBOOK_OWNER" });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("devolve TASK_NOTEBOOK_NOT_FOUND quando o caderno não existe", async () => {
    (repository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      taskNotebookId: Uuid.random(),
      educatorId: owner.id,
    });

    expect(result).toEqual({ ok: false, error: "TASK_NOTEBOOK_NOT_FOUND" });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("devolve DELETE_TASK_NOTEBOOK_FAILED quando o repositório falha", async () => {
    (repository.getById as any).mockRejectedValue(new Error("db"));

    const result = await useCase.execute({
      taskNotebookId: Uuid.random(),
      educatorId: owner.id,
    });

    expect(result).toEqual({ ok: false, error: "DELETE_TASK_NOTEBOOK_FAILED" });
  });
});
