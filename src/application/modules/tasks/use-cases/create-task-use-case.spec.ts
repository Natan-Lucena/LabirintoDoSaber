import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskRepository } from "../../../../domain/repositories/task-repository";
import { TaskCategory, TaskType } from "../../../../domain/entities/task";
import { CreateTaskUseCase } from "./create-task-use-case";
import { success, failure } from "@wave-telecom/framework/core";

// Mock do repositório
const mockTaskRepository = (): TaskRepository => {
  return {
    save: vi.fn(),
    getById: vi.fn(),
    search: vi.fn(),
    delete: vi.fn(),
  } as unknown as TaskRepository;
};

describe("CreateTaskUseCase", () => {
  let taskRepository: TaskRepository;
  let useCase: CreateTaskUseCase;

  beforeEach(() => {
    taskRepository = mockTaskRepository();
    useCase = new CreateTaskUseCase(taskRepository);
  });

  it("should fail if task type is invalid", async () => {
    const result = await useCase.execute({
      category: TaskCategory.Reading,
      type: 999 as TaskType, // tipo inválido
      prompt: "Qual é a capital da França?",
      alternatives: [
        { text: "Paris", isCorrect: true },
        { text: "Londres", isCorrect: false },
      ],
    });

    expect(result).toEqual(failure("INVALID_TASK_TYPE"));
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("should fail if MultipleChoice task has media", async () => {
    const result = await useCase.execute({
      category: TaskCategory.Reading,
      type: TaskType.MultipleChoice,
      prompt: "Qual é a capital da França?",
      alternatives: [
        { text: "Paris", isCorrect: true },
        { text: "Londres", isCorrect: false },
      ],
      imageFile: "image.png",
    });

    expect(result).toEqual(failure("TEXT_TASK_CANNOT_HAVE_MEDIA"));
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("should fail if MultipleChoiceWithMedia task has no media", async () => {
    const result = await useCase.execute({
      category: TaskCategory.Reading,
      type: TaskType.MultipleChoiceWithMedia,
      prompt: "Qual é a capital da França?",
      alternatives: [
        { text: "Paris", isCorrect: true },
        { text: "Londres", isCorrect: false },
      ],
    });

    expect(result).toEqual(failure("MEDIA_TASK_REQUIRES_IMAGE_OR_AUDIO"));
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("should fail if no correct alternative is provided", async () => {
    const result = await useCase.execute({
      category: TaskCategory.Reading,
      type: TaskType.MultipleChoice,
      prompt: "Qual é a capital da França?",
      alternatives: [
        { text: "Paris", isCorrect: false },
        { text: "Londres", isCorrect: false },
      ],
    });

    expect(result).toEqual(failure("AT_LEAST_ONE_ALTERNATIVE_MUST_BE_CORRECT"));
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("should create a valid MultipleChoice task successfully", async () => {
    const payload = {
      category: TaskCategory.Reading,
      type: TaskType.MultipleChoice,
      prompt: "Qual é a capital da França?",
      alternatives: [
        { text: "Paris", isCorrect: true },
        { text: "Londres", isCorrect: false },
      ],
    };

    const result = await useCase.execute(payload);

    expect(result).toEqual(success(void 0));
    expect(taskRepository.save).toHaveBeenCalled();
    const savedTask = (taskRepository.save as any).mock.calls[0][0];
    expect(savedTask.prompt).toBe(payload.prompt);
    expect(savedTask.type).toBe(payload.type);
  });

  it("should create a valid MultipleChoiceWithMedia task successfully", async () => {
    const payload = {
      category: TaskCategory.Reading,
      type: TaskType.MultipleChoiceWithMedia,
      prompt: "Qual é a capital da França?",
      alternatives: [
        { text: "Paris", isCorrect: true },
        { text: "Londres", isCorrect: false },
      ],
      imageFile: "image.png",
    };

    const result = await useCase.execute(payload);

    expect(result).toEqual(success(void 0));
    expect(taskRepository.save).toHaveBeenCalled();
    const savedTask = (taskRepository.save as any).mock.calls[0][0];
    expect(savedTask.prompt).toBe(payload.prompt);
    expect(savedTask.type).toBe(payload.type);
    expect(savedTask.imageFile).toBe(payload.imageFile);
  });
});
