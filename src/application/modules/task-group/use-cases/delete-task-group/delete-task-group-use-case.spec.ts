import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { DeleteTaskGroupUseCase } from "./delete-task-group-use-case";
import { TaskGroup } from "../../../../../domain/entities/task-group";
import { TaskCategory } from "../../../../../domain/entities/task";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";

const makeGroup = (educatorId: Uuid) =>
  TaskGroup.create({
    name: "Grupo",
    educatorId,
    category: TaskCategory.Reading,
  });

describe("DeleteTaskGroupUseCase", () => {
  let repository: TaskGroupRepository;
  let useCase: DeleteTaskGroupUseCase;
  const ownerId = Uuid.random();

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      deleteById: vi.fn(),
    } as unknown as TaskGroupRepository;
    useCase = new DeleteTaskGroupUseCase(repository);
  });

  it("exclui o grupo quando o educador é o dono", async () => {
    const group = makeGroup(ownerId);
    (repository.findById as any).mockResolvedValue(group);

    const result = await useCase.execute({
      taskGroupId: group.id,
      educatorId: ownerId,
    });

    expect(result).toEqual({ ok: true, value: null });
    expect(repository.deleteById).toHaveBeenCalledWith(group.id);
  });

  it("devolve NOT_GROUP_OWNER sem excluir quando o grupo é de outro educador", async () => {
    const group = makeGroup(Uuid.random());
    (repository.findById as any).mockResolvedValue(group);

    const result = await useCase.execute({
      taskGroupId: group.id,
      educatorId: ownerId,
    });

    expect(result).toEqual({ ok: false, error: "NOT_GROUP_OWNER" });
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it("devolve TASK_GROUP_NOT_FOUND quando o grupo não existe", async () => {
    (repository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      taskGroupId: Uuid.random(),
      educatorId: ownerId,
    });

    expect(result).toEqual({ ok: false, error: "TASK_GROUP_NOT_FOUND" });
    expect(repository.deleteById).not.toHaveBeenCalled();
  });

  it("devolve DELETE_TASK_GROUP_FAILED quando o repositório falha", async () => {
    const group = makeGroup(ownerId);
    (repository.findById as any).mockResolvedValue(group);
    (repository.deleteById as any).mockRejectedValue(new Error("db"));

    const result = await useCase.execute({
      taskGroupId: group.id,
      educatorId: ownerId,
    });

    expect(result).toEqual({ ok: false, error: "DELETE_TASK_GROUP_FAILED" });
  });
});
