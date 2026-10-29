import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GetTaskGroupUseCase } from "./get-task-group-use-case";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskGroup } from "../../../../../domain/entities/task-group";
import { TaskCategory } from "../../../../../domain/entities/task";
import {
  TaskNotebook,
  TaskNotebookCategory,
} from "../../../../../domain/entities/task-notebook";
import { Educator } from "../../../../../domain/entities/educator";

const makeEducator = () =>
  Educator.create({
    name: "Educadora",
    email: "educadora@example.com",
    password: "hashed",
  });

const makeGroup = (educatorId: Uuid) =>
  TaskGroup.create({
    name: "Grupo",
    educatorId,
    category: TaskCategory.Reading,
  });

const makeNotebook = (educator: Educator, taskGroupsIds: string[]) => {
  const created = TaskNotebook.create({
    educator,
    category: TaskNotebookCategory.Reading,
    description: "Caderno",
    taskGroupsIds,
  });
  if (!created.ok) throw new Error("fixture inválida");
  return created.value;
};

describe("GetTaskGroupUseCase", () => {
  let taskGroupRepository: TaskGroupRepository;
  let taskNotebookRepository: TaskNotebookRepository;
  let useCase: GetTaskGroupUseCase;
  const educator = makeEducator();

  beforeEach(() => {
    taskGroupRepository = {
      findById: vi.fn(),
    } as unknown as TaskGroupRepository;
    taskNotebookRepository = {
      search: vi.fn().mockResolvedValue([]),
    } as unknown as TaskNotebookRepository;
    useCase = new GetTaskGroupUseCase(taskGroupRepository, taskNotebookRepository);
  });

  it("devolve o grupo quando ele é do educador", async () => {
    const group = makeGroup(educator.id);
    (taskGroupRepository.findById as any).mockResolvedValue(group);

    const result = await useCase.execute({
      taskGroupId: group.id.value,
      educatorId: educator.id,
    });

    expect(result).toEqual({ ok: true, value: group });
    expect(taskNotebookRepository.search).not.toHaveBeenCalled();
  });

  it("devolve o grupo de terceiro que está em um caderno do educador", async () => {
    const group = makeGroup(Uuid.random());
    (taskGroupRepository.findById as any).mockResolvedValue(group);
    (taskNotebookRepository.search as any).mockResolvedValue([
      makeNotebook(educator, [Uuid.random().value]),
      makeNotebook(educator, [group.id.value]),
    ]);

    const result = await useCase.execute({
      taskGroupId: group.id.value,
      educatorId: educator.id,
    });

    expect(result).toEqual({ ok: true, value: group });
    expect(taskNotebookRepository.search).toHaveBeenCalledWith({
      educatorId: educator.id,
    });
  });

  it("nega o grupo de terceiro fora dos cadernos do educador", async () => {
    const group = makeGroup(Uuid.random());
    (taskGroupRepository.findById as any).mockResolvedValue(group);
    (taskNotebookRepository.search as any).mockResolvedValue([
      makeNotebook(educator, [Uuid.random().value]),
    ]);

    const result = await useCase.execute({
      taskGroupId: group.id.value,
      educatorId: educator.id,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("devolve TASK_GROUP_NOT_FOUND quando o grupo não existe", async () => {
    (taskGroupRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      taskGroupId: Uuid.random().value,
      educatorId: educator.id,
    });

    expect(result).toEqual({ ok: false, error: "TASK_GROUP_NOT_FOUND" });
  });

  it("devolve TASK_GROUP_NOT_FOUND para id inválido sem consultar o banco", async () => {
    const result = await useCase.execute({
      taskGroupId: "nao-e-uuid",
      educatorId: educator.id,
    });

    expect(result).toEqual({ ok: false, error: "TASK_GROUP_NOT_FOUND" });
    expect(taskGroupRepository.findById).not.toHaveBeenCalled();
  });
});
