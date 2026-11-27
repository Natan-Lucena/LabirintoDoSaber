import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GetTaskByIdUseCase } from "./get-task-by-id-use-case";
import { makeLibraryTask, makeTaskRepository } from "../test-fixtures";

describe("GetTaskByIdUseCase", () => {
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let useCase: GetTaskByIdUseCase;

  beforeEach(() => {
    taskRepository = makeTaskRepository();
    useCase = new GetTaskByIdUseCase(taskRepository);
  });

  it("PP-11: id inválido → TASK_NOT_FOUND", async () => {
    expect(await useCase.execute({ taskId: "nao-e-uuid" })).toEqual({
      ok: false,
      error: "TASK_NOT_FOUND",
    });
    expect(taskRepository.getById).not.toHaveBeenCalled();
  });

  it("PP-11: inexistente → TASK_NOT_FOUND", async () => {
    taskRepository.getById.mockResolvedValue(null);
    expect(await useCase.execute({ taskId: Uuid.random().value })).toEqual({
      ok: false,
      error: "TASK_NOT_FOUND",
    });
  });

  it("devolve a tarefa com content (inclusive da biblioteca)", async () => {
    const library = makeLibraryTask();
    taskRepository.getById.mockResolvedValue(library);

    const result = await useCase.execute({ taskId: library.id.value });

    expect(result).toEqual({ ok: true, value: library });
    const json = JSON.parse(JSON.stringify(library));
    expect(json).toMatchObject({
      id: library.id.value,
      type: "wordBuilder",
      format: "INTERACTIVE",
      source: "LIBRARY",
      content: { kind: "wordBuilder", word: "BOLA" },
      skills: [],
    });
    expect(json).not.toHaveProperty("educatorId");
  });
});
