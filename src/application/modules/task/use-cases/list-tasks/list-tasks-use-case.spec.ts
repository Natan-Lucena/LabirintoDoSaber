import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { TaskCategory, TaskType } from "../../../../../domain/entities/task";
import { ListTasksUseCase } from "./list-tasks-use-case";
import {
  makeMultipleChoiceTask,
  makeTaskRepository,
  makeWordBuilderTask,
} from "../test-fixtures";

describe("ListTasksUseCase (GET /task/)", () => {
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let useCase: ListTasksUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    taskRepository = makeTaskRepository();
    useCase = new ListTasksUseCase(taskRepository);
  });

  it("AT-11: lista só as tarefas do educador do token", async () => {
    const own = [makeMultipleChoiceTask({ educatorId }), makeWordBuilderTask({ educatorId })];
    taskRepository.listByEducator.mockResolvedValue(own);

    const result = await useCase.execute({ educatorId });

    expect(result).toEqual({ ok: true, value: own });
    expect(taskRepository.listByEducator).toHaveBeenCalledWith(educatorId);
    expect(taskRepository.listLibrary).not.toHaveBeenCalled();
  });

  it("BE-AT-06: tarefa antiga sai no formato de antes, com os defaults novos", async () => {
    const legacy = makeMultipleChoiceTask();
    taskRepository.listByEducator.mockResolvedValue([legacy]);

    const result = await useCase.execute({ educatorId });

    if (!result.ok) throw new Error("deveria listar");
    const [json] = JSON.parse(JSON.stringify(result.value));
    expect(json).toMatchObject({
      id: legacy.id.value,
      category: "reading",
      type: "multipleChoice",
      prompt: "Qual palavra rima com gato?",
      alternatives: [
        { id: expect.any(String), text: "Pato", isCorrect: true },
        { id: expect.any(String), text: "Casa", isCorrect: false },
      ],
      createdAt: expect.any(String),
      format: "INTERACTIVE",
      source: "EDUCATOR",
      skills: [],
      tone: expect.any(String),
    });
    expect(json).not.toHaveProperty("content");
  });

  it("mantém os filtros antigos (id, categoria, tipo, trecho do prompt sem acento)", async () => {
    const reading = makeMultipleChoiceTask({ educatorId, prompt: "Qual é a vogal?" });
    const writing = makeWordBuilderTask({ educatorId });
    taskRepository.listByEducator.mockResolvedValue([reading, writing]);

    expect(await useCase.execute({ educatorId, category: TaskCategory.Writing })).toEqual({
      ok: true,
      value: [writing],
    });
    expect(await useCase.execute({ educatorId, type: TaskType.MultipleChoice })).toEqual({
      ok: true,
      value: [reading],
    });
    expect(await useCase.execute({ educatorId, promptContains: "QUAL E" })).toEqual({
      ok: true,
      value: [reading],
    });
    expect(await useCase.execute({ educatorId, id: writing.id })).toEqual({
      ok: true,
      value: [writing],
    });
  });

  it("LIST_TASKS_FAILED quando o repositório falha", async () => {
    taskRepository.listByEducator.mockRejectedValue(new Error("DB error"));
    expect(await useCase.execute({ educatorId })).toEqual({
      ok: false,
      error: "LIST_TASKS_FAILED",
    });
  });
});
