import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure } from "@wave-telecom/framework/core";
import { GenerateTasksUseCase } from "./generate-tasks-use-case";
import { TaskCategory, TaskType } from "../../../../../domain/entities/task";
import {
  AiTaskGeneratorService,
  GeneratedTaskDraft,
} from "../../../../../domain/services/ai-task-generator-service";

const validDraft: GeneratedTaskDraft = {
  prompt: "Qual palavra rima com 'gato'?",
  alternatives: [
    { text: "Pato", isCorrect: true },
    { text: "Cadeira", isCorrect: false },
  ],
};

const mockGenerator = (): AiTaskGeneratorService =>
  ({
    generate: vi.fn(),
  } as unknown as AiTaskGeneratorService);

const baseRequest = {
  targetAudience: "Criança de 7 anos com dislexia",
  instructions: "Atividades curtas de rima",
  quantity: 2,
  category: TaskCategory.Reading,
};

describe("GenerateTasksUseCase", () => {
  let generator: AiTaskGeneratorService;
  let useCase: GenerateTasksUseCase;

  beforeEach(() => {
    generator = mockGenerator();
    useCase = new GenerateTasksUseCase(generator);
  });

  it("should fail when quantity is below 1", async () => {
    const result = await useCase.execute({ ...baseRequest, quantity: 0 });

    expect(result).toEqual(failure("INVALID_QUANTITY"));
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("should fail when quantity is above 15", async () => {
    const result = await useCase.execute({ ...baseRequest, quantity: 16 });

    expect(result).toEqual(failure("INVALID_QUANTITY"));
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it("should fail when quantity is not an integer", async () => {
    const result = await useCase.execute({ ...baseRequest, quantity: 2.5 });

    expect(result).toEqual(failure("INVALID_QUANTITY"));
  });

  it("should return AI_GENERATION_FAILED when the service throws", async () => {
    (generator.generate as any).mockRejectedValue(new Error("boom"));

    const result = await useCase.execute(baseRequest);

    expect(result).toEqual(failure("AI_GENERATION_FAILED"));
  });

  it("should return AI_INVALID_OUTPUT when every draft is invalid", async () => {
    (generator.generate as any).mockResolvedValue([
      {
        prompt: "Sem alternativa correta",
        alternatives: [
          { text: "A", isCorrect: false },
          { text: "B", isCorrect: false },
        ],
      },
    ]);

    const result = await useCase.execute(baseRequest);

    expect(result).toEqual(failure("AI_INVALID_OUTPUT"));
  });

  it("should return valid tasks as DTOs (MultipleChoice, chosen category)", async () => {
    (generator.generate as any).mockResolvedValue([validDraft, validDraft]);

    const result = await useCase.execute(baseRequest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.tasks).toHaveLength(2);
    const [task] = result.value.tasks;
    expect(task.type).toBe(TaskType.MultipleChoice);
    expect(task.category).toBe(TaskCategory.Reading);
    expect(task.prompt).toBe(validDraft.prompt);
    expect(task.alternatives).toEqual(validDraft.alternatives);
  });

  it("should drop invalid drafts but keep valid ones", async () => {
    (generator.generate as any).mockResolvedValue([
      validDraft,
      {
        prompt: "Inválida",
        alternatives: [{ text: "Só uma", isCorrect: true }],
      },
    ]);

    const result = await useCase.execute(baseRequest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tasks).toHaveLength(1);
  });

  it("should forward the use-case inputs to the generator", async () => {
    (generator.generate as any).mockResolvedValue([validDraft]);

    await useCase.execute(baseRequest);

    expect(generator.generate).toHaveBeenCalledWith({
      targetAudience: baseRequest.targetAudience,
      instructions: baseRequest.instructions,
      quantity: baseRequest.quantity,
      category: baseRequest.category,
    });
  });
});
