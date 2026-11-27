import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UpdateTaskGroupUseCase } from "./update-task-group-use-case";
import { TaskGroup } from "../../../../../domain/entities/task-group";
import { TaskCategory } from "../../../../../domain/entities/task";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { UpdateTaskGroupSchema } from "../../schemas/update-task-group-schema";
import {
  makeLibraryTask,
  makePrintableTask,
  makeTaskRepository,
} from "../../../task/use-cases/test-fixtures";

const makeGroup = (educatorId: Uuid) =>
  TaskGroup.create({
    name: "Grupo",
    educatorId,
    category: TaskCategory.Reading,
  });

describe("UpdateTaskGroupUseCase", () => {
  let repository: TaskGroupRepository;
  let useCase: UpdateTaskGroupUseCase;
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  const ownerId = Uuid.random();

  beforeEach(() => {
    repository = {
      findById: vi.fn(),
      save: vi.fn(),
    } as unknown as TaskGroupRepository;
    taskRepository = makeTaskRepository();
    useCase = new UpdateTaskGroupUseCase(repository, taskRepository);
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

  it("devolve TASK_GROUP_NOT_FOUND sem consultar o banco quando o id não é UUID", async () => {
    const result = await useCase.execute({
      id: "id-invalido",
      educatorId: ownerId,
    });

    expect(result).toEqual({ ok: false, error: "TASK_GROUP_NOT_FOUND" });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it("BE-AT-05: imprimível no grupo → PRINTABLE_NOT_PLAYABLE sem salvar", async () => {
    const group = makeGroup(ownerId);
    (repository.findById as any).mockResolvedValue(group);
    const printable = makePrintableTask();
    taskRepository.getByIds.mockResolvedValue([printable]);

    const result = await useCase.execute({
      id: group.id.value,
      educatorId: ownerId,
      tasksIds: [printable.id.value],
    });

    expect(result).toEqual({ ok: false, error: "PRINTABLE_NOT_PLAYABLE" });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("tarefa EDUCATOR de outro educador → UNAUTHORIZED sem salvar", async () => {
    const group = makeGroup(ownerId);
    (repository.findById as any).mockResolvedValue(group);
    const othersTask = makeLibraryTask({ source: undefined, educatorId: Uuid.random() });
    taskRepository.getByIds.mockResolvedValue([othersTask]);

    const result = await useCase.execute({
      id: group.id.value,
      educatorId: ownerId,
      tasksIds: [othersTask.id.value],
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("AT-10: aceita tarefa da biblioteca e de tipo novo", async () => {
    const group = makeGroup(ownerId);
    (repository.findById as any).mockResolvedValue(group);
    const library = makeLibraryTask();
    taskRepository.getByIds.mockResolvedValue([library]);

    const result = await useCase.execute({
      id: group.id.value,
      educatorId: ownerId,
      tasksIds: [library.id.value],
    });

    expect(result).toEqual({ ok: true, value: undefined });
    const saved = (repository.save as any).mock.calls[0][0] as TaskGroup;
    expect(saved.tasksIds).toEqual([library.id.value]);
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
