import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { SaveTaskBatchUseCase } from "./save-task-batch-use-case";
import { saveTaskBatchSchema } from "../../schemas/save-task-batch-schema";
import { BUCKET_URL, makeFileStorage } from "../test-fixtures";
import { TaskCategory, TaskType } from "../../../../../domain/entities/task";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";

const mockTaskRepository = (): TaskRepository =>
  ({
    save: vi.fn(),
    saveMany: vi.fn(),
    getById: vi.fn(),
    search: vi.fn(),
    delete: vi.fn(),
  } as unknown as TaskRepository);

const mockTaskGroupRepository = (): TaskGroupRepository =>
  ({
    save: vi.fn((group) => Promise.resolve(group)),
    findById: vi.fn(),
    search: vi.fn(),
    deleteById: vi.fn(),
  } as unknown as TaskGroupRepository);

const mockEducatorRepository = (): EducatorRepository =>
  ({
    save: vi.fn(),
    search: vi.fn(),
    getByEmail: vi.fn(),
    delete: vi.fn(),
  } as unknown as EducatorRepository);

const educator = { id: Uuid.random() };

const textTask = {
  category: TaskCategory.Reading,
  type: TaskType.MultipleChoice,
  prompt: "Qual é a vogal na palavra 'sol'?",
  alternatives: [
    { text: "O", isCorrect: true },
    { text: "S", isCorrect: false },
  ],
};

const mediaTask = {
  category: TaskCategory.Reading,
  type: TaskType.MultipleChoiceWithMedia,
  prompt: "Que animal aparece na imagem?",
  alternatives: [
    { text: "Gato", isCorrect: true },
    { text: "Cachorro", isCorrect: false },
  ],
  imageFile: `${BUCKET_URL}img.png`,
};

describe("SaveTaskBatchUseCase", () => {
  let taskRepository: TaskRepository;
  let taskGroupRepository: TaskGroupRepository;
  let educatorRepository: EducatorRepository;
  let useCase: SaveTaskBatchUseCase;

  beforeEach(() => {
    taskRepository = mockTaskRepository();
    taskGroupRepository = mockTaskGroupRepository();
    educatorRepository = mockEducatorRepository();
    useCase = new SaveTaskBatchUseCase(
      taskRepository,
      taskGroupRepository,
      educatorRepository,
      makeFileStorage()
    );
    (educatorRepository.getByEmail as any).mockResolvedValue(educator);
  });

  const baseRequest = {
    name: "Grupo de leitura - Turma A",
    category: TaskCategory.Reading,
    educatorEmail: "prof@example.com",
  };

  it("should fail when the task list is empty", async () => {
    const result = await useCase.execute({ ...baseRequest, tasks: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("EMPTY_TASK_LIST");
    expect(taskRepository.saveMany).not.toHaveBeenCalled();
  });

  it("should fail when the educator does not exist", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue(null);

    const result = await useCase.execute({
      ...baseRequest,
      tasks: [textTask],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("EDUCATOR_NOT_FOUND");
    expect(taskRepository.saveMany).not.toHaveBeenCalled();
  });

  it("should fail with INVALID_TASK_DATA and persist nothing when a task is invalid", async () => {
    const invalidTask = {
      ...textTask,
      alternatives: [{ text: "Única", isCorrect: true }],
    };

    const result = await useCase.execute({
      ...baseRequest,
      tasks: [textTask, invalidTask],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("INVALID_TASK_DATA");
    expect(taskRepository.saveMany).not.toHaveBeenCalled();
    expect(taskGroupRepository.save).not.toHaveBeenCalled();
  });

  it("AT-05: imageFile/audioFile fora do armazenamento → INVALID_MEDIA_URL com o campo", async () => {
    const result = await useCase.execute({
      ...baseRequest,
      tasks: [textTask, { ...mediaTask, audioFile: "https://cdn.example.com/a.mp3" }],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_MEDIA_URL",
        errors: [{ field: "tasks.1.audioFile", message: expect.any(String) }],
      },
    });
    expect(taskRepository.saveMany).not.toHaveBeenCalled();
    expect(taskGroupRepository.save).not.toHaveBeenCalled();
  });

  it("should persist tasks (text + media) and create the group", async () => {
    const result = await useCase.execute({
      ...baseRequest,
      tasks: [textTask, mediaTask],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(taskRepository.saveMany).toHaveBeenCalledTimes(1);
    const savedTasks = (taskRepository.saveMany as any).mock.calls[0][0];
    expect(savedTasks).toHaveLength(2);
    for (const task of savedTasks) {
      expect(task.educatorId.value).toBe(educator.id.value);
    }

    expect(taskGroupRepository.save).toHaveBeenCalledTimes(1);
    const savedGroup = (taskGroupRepository.save as any).mock.calls[0][0];
    expect(savedGroup.tasksIds).toHaveLength(2);
    expect(savedGroup.tasksIds).toEqual(result.value.taskIds);
    expect(result.value.taskGroup.name).toBe(baseRequest.name);
  });
});

describe("saveTaskBatchSchema", () => {
  it("aceita só múltipla escolha (o lote vira grupo, e imprimível não entra em grupo)", () => {
    const parse = (type: string) =>
      saveTaskBatchSchema.safeParse({
        name: "Grupo",
        category: TaskCategory.Reading,
        tasks: [{ ...textTask, type }],
      }).success;

    expect(parse(TaskType.MultipleChoice)).toBe(true);
    expect(parse(TaskType.Printable)).toBe(false);
    expect(parse(TaskType.WordBuilder)).toBe(false);
  });
});
