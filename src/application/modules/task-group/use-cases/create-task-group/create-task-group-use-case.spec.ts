import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { CreateTaskGroupUseCase } from "./create-task-group-use-case";
import { TaskCategory } from "../../../../../domain/entities/task";
import { TaskGroup } from "../../../../../domain/entities/task-group";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import {
  makeLibraryTask,
  makePrintableTask,
  makeTaskRepository,
  makeWordBuilderTask,
} from "../../../task/use-cases/test-fixtures";

describe("CreateTaskGroupUseCase", () => {
  let groupRepository: TaskGroupRepository;
  let educatorRepository: EducatorRepository;
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let useCase: CreateTaskGroupUseCase;
  const educator = { id: Uuid.random(), email: "edu@example.com" };

  beforeEach(() => {
    groupRepository = { save: vi.fn() } as unknown as TaskGroupRepository;
    educatorRepository = {
      getByEmail: vi.fn().mockResolvedValue(educator),
    } as unknown as EducatorRepository;
    taskRepository = makeTaskRepository();
    useCase = new CreateTaskGroupUseCase(groupRepository, educatorRepository, taskRepository);
  });

  it("BE-AT-05: imprimível no grupo → PRINTABLE_NOT_PLAYABLE sem salvar", async () => {
    const printable = makePrintableTask();
    taskRepository.getByIds.mockResolvedValue([printable, makeWordBuilderTask()]);

    const result = await useCase.execute({
      name: "Grupo",
      category: TaskCategory.Reading,
      educatorEmail: educator.email,
      tasksIds: [printable.id.value],
    });

    expect(result).toEqual({ ok: false, error: "PRINTABLE_NOT_PLAYABLE" });
    expect(groupRepository.save).not.toHaveBeenCalled();
  });

  it("AT-10: aceita tarefas da biblioteca e dos tipos novos", async () => {
    const library = makeLibraryTask();
    const own = makeWordBuilderTask({ educatorId: educator.id });
    taskRepository.getByIds.mockResolvedValue([library, own]);

    const result = await useCase.execute({
      name: "Grupo",
      category: TaskCategory.Writing,
      educatorEmail: educator.email,
      tasksIds: [library.id.value, own.id.value],
    });

    expect(result.ok).toBe(true);
    const saved = (groupRepository.save as any).mock.calls[0][0] as TaskGroup;
    expect(saved.tasksIds).toEqual([library.id.value, own.id.value]);
    expect(saved.educatorId.value).toBe(educator.id.value);
  });

  it("grupo vazio não consulta tarefas", async () => {
    const result = await useCase.execute({
      name: "Grupo",
      category: TaskCategory.Writing,
      educatorEmail: educator.email,
    });

    expect(result.ok).toBe(true);
    expect(taskRepository.getByIds).not.toHaveBeenCalled();
  });
});
