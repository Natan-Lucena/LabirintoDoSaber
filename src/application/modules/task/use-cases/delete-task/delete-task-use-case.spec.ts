import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { DeleteTaskUseCase } from "./delete-task-use-case";
import {
  makeLibraryTask,
  makeMultipleChoiceTask,
  makeTaskRepository,
  makeWordBuilderTask,
} from "../test-fixtures";

describe("DeleteTaskUseCase", () => {
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let useCase: DeleteTaskUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    taskRepository = makeTaskRepository();
    useCase = new DeleteTaskUseCase(taskRepository);
  });

  it("id inválido → TASK_NOT_FOUND (404, não 500)", async () => {
    const result = await useCase.execute({ taskId: "abc", educatorId });
    expect(result).toEqual({ ok: false, error: "TASK_NOT_FOUND" });
    expect(taskRepository.delete).not.toHaveBeenCalled();
  });

  it("inexistente → TASK_NOT_FOUND", async () => {
    taskRepository.getById.mockResolvedValue(null);
    const result = await useCase.execute({ taskId: Uuid.random().value, educatorId });
    expect(result).toEqual({ ok: false, error: "TASK_NOT_FOUND" });
  });

  it("biblioteca → LIBRARY_TASK_READ_ONLY", async () => {
    const library = makeLibraryTask();
    taskRepository.getById.mockResolvedValue(library);

    const result = await useCase.execute({ taskId: library.id.value, educatorId });

    expect(result).toEqual({ ok: false, error: "LIBRARY_TASK_READ_ONLY" });
    expect(taskRepository.delete).not.toHaveBeenCalled();
  });

  it("de outro educador → UNAUTHORIZED", async () => {
    const task = makeWordBuilderTask({ educatorId: Uuid.random() });
    taskRepository.getById.mockResolvedValue(task);

    const result = await useCase.execute({ taskId: task.id.value, educatorId });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(taskRepository.delete).not.toHaveBeenCalled();
  });

  it("antiga sem dono em caderno/grupo de outro educador → UNAUTHORIZED", async () => {
    const legacy = makeMultipleChoiceTask();
    taskRepository.getById.mockResolvedValue(legacy);
    taskRepository.findLegacyOwners.mockResolvedValue(
      new Map([[legacy.id.value, [Uuid.random().value]]])
    );

    const result = await useCase.execute({ taskId: legacy.id.value, educatorId });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(taskRepository.delete).not.toHaveBeenCalled();
  });

  it("exclui a própria e a antiga avulsa (sem dono, fora de caderno e grupo)", async () => {
    for (const task of [makeWordBuilderTask({ educatorId }), makeMultipleChoiceTask()]) {
      taskRepository.getById.mockResolvedValue(task);
      const result = await useCase.execute({ taskId: task.id.value, educatorId });
      expect(result).toEqual({ ok: true, value: null });
      expect(taskRepository.delete).toHaveBeenLastCalledWith(task.id);
    }
  });
});
