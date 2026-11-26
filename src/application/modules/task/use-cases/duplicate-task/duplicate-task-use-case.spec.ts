import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Task, TaskSource } from "../../../../../domain/entities/task";
import { DuplicateTaskUseCase } from "./duplicate-task-use-case";
import { UpdateTaskUseCase } from "../update-task/update-task-use-case";
import {
  makeFileStorage,
  makeLibraryTask,
  makeMultipleChoiceTask,
  makeSkillRepository,
  makeTaskRepository,
  makeWordBuilderTask,
} from "../test-fixtures";

describe("DuplicateTaskUseCase", () => {
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let useCase: DuplicateTaskUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    taskRepository = makeTaskRepository();
    useCase = new DuplicateTaskUseCase(taskRepository);
  });

  it("id inválido ou inexistente → TASK_NOT_FOUND", async () => {
    expect(await useCase.execute({ taskId: "x", educatorId })).toEqual({
      ok: false,
      error: "TASK_NOT_FOUND",
    });
    taskRepository.getById.mockResolvedValue(null);
    expect(await useCase.execute({ taskId: Uuid.random().value, educatorId })).toEqual({
      ok: false,
      error: "TASK_NOT_FOUND",
    });
  });

  it("tarefa de outro educador → UNAUTHORIZED", async () => {
    const task = makeWordBuilderTask({ educatorId: Uuid.random() });
    taskRepository.getById.mockResolvedValue(task);

    expect(await useCase.execute({ taskId: task.id.value, educatorId })).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("BE-AT-03: duplicar da biblioteca gera cópia EDUCATOR editável", async () => {
    const library = makeLibraryTask({ skills: ["VOCABULARIO"], theme: "Brinquedos" });
    taskRepository.getById.mockResolvedValue(library);

    const result = await useCase.execute({ taskId: library.id.value, educatorId });

    expect(result.ok).toBe(true);
    const copy = taskRepository.save.mock.calls[0][0] as Task;
    expect(result).toEqual({ ok: true, value: copy });
    expect(copy.id.value).not.toBe(library.id.value);
    expect(copy.source).toBe(TaskSource.Educator);
    expect(copy.educatorId?.value).toBe(educatorId.value);
    expect(copy.content).toEqual(library.content);
    expect(copy.skills).toEqual(["VOCABULARIO"]);

    // A cópia aceita edição do mesmo educador.
    taskRepository.getById.mockResolvedValue(copy);
    const update = new UpdateTaskUseCase(taskRepository, makeSkillRepository(), makeFileStorage());
    const edited = await update.execute({ educatorId, id: copy.id.value, prompt: "Minha versão" });
    expect(edited.ok).toBe(true);
  });

  it("antiga sem dono em caderno/grupo de outro educador → UNAUTHORIZED", async () => {
    const legacy = makeMultipleChoiceTask();
    taskRepository.getById.mockResolvedValue(legacy);
    taskRepository.findLegacyOwners.mockResolvedValue(
      new Map([[legacy.id.value, [Uuid.random().value]]])
    );

    expect(await useCase.execute({ taskId: legacy.id.value, educatorId })).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("duplica tarefa antiga avulsa, com ids novos nas alternativas", async () => {
    const legacy = makeMultipleChoiceTask();
    taskRepository.getById.mockResolvedValue(legacy);

    const result = await useCase.execute({ taskId: legacy.id.value, educatorId });

    expect(result.ok).toBe(true);
    const copy = taskRepository.save.mock.calls[0][0] as Task;
    expect(copy.alternatives.map((alt) => alt.text)).toEqual(["Pato", "Casa"]);
    expect(copy.alternatives[0].id?.value).not.toBe(legacy.alternatives[0].id?.value);
  });
});
