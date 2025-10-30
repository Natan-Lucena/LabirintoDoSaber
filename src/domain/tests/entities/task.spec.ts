import { describe, it, expect } from "vitest";
import { Task, TaskType, TaskCategory } from "../../entities/task";
import { failure } from "@wave-telecom/framework/core";

describe("Task Entity", () => {
  it("should create a valid MultipleChoice task", () => {
    const result = Task.create({
      category: TaskCategory.Reading,
      type: TaskType.MultipleChoice,
      prompt: "Escolha a alternativa correta",
      alternatives: [
        { text: "Errada", isCorrect: false },
        { text: "Correta", isCorrect: true },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.ok && "value" in result ? result.value.prompt : undefined).toBe(
      "Escolha a alternativa correta"
    );
  });

  it("should create a valid MultipleChoiceWithMedia task with image", () => {
    const result = Task.create({
      category: TaskCategory.Writing,
      type: TaskType.MultipleChoiceWithMedia,
      prompt: "Escolha a alternativa correta",
      alternatives: [
        { text: "Errada", isCorrect: false },
        { text: "Correta", isCorrect: true },
      ],
      imageFile: "image.png",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && "value" in result ? result.value.imageFile : undefined).toBe(
      "image.png"
    );
  });

  it("should fail if less than 2 alternatives", () => {
    const result = Task.create({
      category: TaskCategory.Vocabulary,
      type: TaskType.MultipleChoice,
      prompt: "Somente uma alternativa",
      alternatives: [{ text: "Somente uma", isCorrect: true }],
    });

    expect(result).toEqual(failure(undefined));
  });

  it("should fail if no correct alternative", () => {
    const result = Task.create({
      category: TaskCategory.Comprehension,
      type: TaskType.MultipleChoice,
      prompt: "Nenhuma correta",
      alternatives: [
        { text: "Errada 1", isCorrect: false },
        { text: "Errada 2", isCorrect: false },
      ],
    });

    expect(result).toEqual(failure(undefined));
  });

  it("should fail if more than one correct alternative", () => {
    const result = Task.create({
      category: TaskCategory.Reading,
      type: TaskType.MultipleChoice,
      prompt: "Duas corretas",
      alternatives: [
        { text: "Correta 1", isCorrect: true },
        { text: "Correta 2", isCorrect: true },
      ],
    });

    expect(result).toEqual(failure(undefined));
  });

  it("should fail if MultipleChoiceWithMedia has no media", () => {
    const result = Task.create({
      category: TaskCategory.Writing,
      type: TaskType.MultipleChoiceWithMedia,
      prompt: "Precisa de mídia",
      alternatives: [
        { text: "Errada", isCorrect: false },
        { text: "Correta", isCorrect: true },
      ],
    });

    expect(result).toEqual(failure(undefined));
  });

  it("should fail if MultipleChoice has media", () => {
    const result = Task.create({
      category: TaskCategory.Reading,
      type: TaskType.MultipleChoice,
      prompt: "Não pode ter mídia",
      alternatives: [
        { text: "Errada", isCorrect: false },
        { text: "Correta", isCorrect: true },
      ],
      imageFile: "image.png",
    });

    expect(result).toEqual(failure(undefined));
  });
});
