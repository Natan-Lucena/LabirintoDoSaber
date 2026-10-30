import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UpdateTaskGroupUseCase } from "./update-task-group-use-case";
import { TaskGroup } from "../../../../../domain/entities/task-group";
import { TaskCategory } from "../../../../../domain/entities/task";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { UpdateTaskGroupSchema } from "../../schemas/update-task-group-schema";

const makeGroup = (educatorId: Uuid) =>
  TaskGroup.create({
    name: "Grupo",
    educatorId,
    category: TaskCategory.Reading,
  });

describe("UpdateTaskGroupUseCase", () => {
  let repository: TaskGroupRepository;
  let useCase: UpdateTaskGroupUseCase;
  const ownerId = Uuid.random();

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      save: vi.fn(),
    } as unknown as TaskGroupRepository;
    useCase = new UpdateTaskGroupUseCase(repository);
  });

  it("atualiza o grupo quando o educador é o dono, mantendo o dono", async () => {
    const group = makeGroup(ownerId);
    (repository.findById as any).mockResolvedValue(group);

    const result = await useCase.execute({
      id: group.id.value,
      educatorId: ownerId,
      name: "Novo Nome",
      category: TaskCategory.Writing,
    });

    expect(result).toEqual({ ok: true, value: undefined });
    const saved = (repository.save as any).mock.calls[0][0] as TaskGroup;
    expect(saved.id.value).toBe(group.id.value);
    expect(saved.name).toBe("Novo Nome");
    expect(saved.category).toBe(TaskCategory.Writing);
    expect(saved.educatorId.value).toBe(ownerId.value);
  });

  it("o schema descarta educatorId do corpo, então o dono não muda", () => {
    const id = Uuid.random().value;
    const parsed = UpdateTaskGroupSchema.parse({
      id,
      name: "Novo Nome",
      educatorId: Uuid.random().value,
    });

    expect(parsed).toEqual({ id, name: "Novo Nome" });
  });

  it("devolve NOT_GROUP_OWNER sem salvar quando o grupo é de outro educador", async () => {
    const group = makeGroup(Uuid.random());
    (repository.findById as any).mockResolvedValue(group);

    const result = await useCase.execute({
      id: group.id.value,
      educatorId: ownerId,
      name: "Tentativa",
    });

    expect(result).toEqual({ ok: false, error: "NOT_GROUP_OWNER" });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("devolve TASK_GROUP_NOT_FOUND quando o grupo não existe", async () => {
    (repository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      id: Uuid.random().value,
      educatorId: ownerId,
    });

    expect(result).toEqual({ ok: false, error: "TASK_GROUP_NOT_FOUND" });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("devolve INVALID_TASK_GROUP_ID sem consultar o banco", async () => {
    const result = await useCase.execute({
      id: "id-invalido",
      educatorId: ownerId,
    });

    expect(result).toEqual({ ok: false, error: "INVALID_TASK_GROUP_ID" });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it("devolve UPDATE_TASK_GROUP_FAILED quando o salvamento falha", async () => {
    const group = makeGroup(ownerId);
    (repository.findById as any).mockResolvedValue(group);
    (repository.save as any).mockRejectedValue(new Error("timeout"));

    const result = await useCase.execute({
      id: group.id.value,
      educatorId: ownerId,
      name: "Novo Nome",
    });

    expect(result).toEqual({ ok: false, error: "UPDATE_TASK_GROUP_FAILED" });
  });
});
