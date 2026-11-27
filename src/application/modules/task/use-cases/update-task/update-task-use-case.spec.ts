import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Task, TaskTone, TaskType } from "../../../../../domain/entities/task";
import { UpdateTaskUseCase } from "./update-task-use-case";
import { updateTaskSchema } from "../../schemas/update-task-schemas";
import {
  BUCKET_URL,
  makeFileStorage,
  makeLibraryTask,
  makeMultipleChoiceTask,
  makeSkillRepository,
  makeTaskRepository,
  makeWordBuilderTask,
} from "../test-fixtures";

describe("UpdateTaskUseCase", () => {
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let fileStorage: ReturnType<typeof makeFileStorage>;
  let useCase: UpdateTaskUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    taskRepository = makeTaskRepository();
    fileStorage = makeFileStorage();
    useCase = new UpdateTaskUseCase(taskRepository, makeSkillRepository(), fileStorage);
  });

  it("id inválido → TASK_NOT_FOUND sem consultar o banco", async () => {
    const result = await useCase.execute({ educatorId, id: "id-invalido" });
    expect(result).toEqual({ ok: false, error: "TASK_NOT_FOUND" });
    expect(taskRepository.getById).not.toHaveBeenCalled();
  });

  it("tarefa inexistente → TASK_NOT_FOUND", async () => {
    taskRepository.getById.mockResolvedValue(null);
    const result = await useCase.execute({ educatorId, id: Uuid.random().value });
    expect(result).toEqual({ ok: false, error: "TASK_NOT_FOUND" });
  });

  it("BE-AT-03: tarefa da biblioteca → LIBRARY_TASK_READ_ONLY", async () => {
    const library = makeLibraryTask();
    taskRepository.getById.mockResolvedValue(library);

    const result = await useCase.execute({ educatorId, id: library.id.value, prompt: "Outro" });

    expect(result).toEqual({ ok: false, error: "LIBRARY_TASK_READ_ONLY" });
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("tarefa de outro educador → UNAUTHORIZED", async () => {
    const task = makeWordBuilderTask({ educatorId: Uuid.random() });
    taskRepository.getById.mockResolvedValue(task);

    const result = await useCase.execute({ educatorId, id: task.id.value, prompt: "Outro" });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("tarefa antiga sem dono continua editável", async () => {
    const legacy = makeMultipleChoiceTask();
    taskRepository.getById.mockResolvedValue(legacy);

    const result = await useCase.execute({ educatorId, id: legacy.id.value, prompt: "Novo" });

    expect(result.ok).toBe(true);
    const saved = taskRepository.save.mock.calls[0][0] as Task;
    expect(saved.prompt).toBe("Novo");
    expect(result).toEqual({ ok: true, value: saved });
  });

  it("antiga sem dono em caderno/grupo de outro educador → UNAUTHORIZED", async () => {
    const legacy = makeMultipleChoiceTask();
    taskRepository.getById.mockResolvedValue(legacy);
    taskRepository.findLegacyOwners.mockResolvedValue(
      new Map([[legacy.id.value, [Uuid.random().value]]])
    );

    const result = await useCase.execute({ educatorId, id: legacy.id.value, prompt: "Novo" });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(taskRepository.findLegacyOwners).toHaveBeenCalledWith([legacy.id]);
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("antiga sem dono em caderno/grupo do próprio educador é editável", async () => {
    const legacy = makeMultipleChoiceTask();
    taskRepository.getById.mockResolvedValue(legacy);
    taskRepository.findLegacyOwners.mockResolvedValue(
      new Map([[legacy.id.value, [Uuid.random().value, educatorId.value]]])
    );

    const result = await useCase.execute({ educatorId, id: legacy.id.value, prompt: "Novo" });

    expect(result.ok).toBe(true);
  });

  it("troca entre multipleChoice e multipleChoiceWithMedia", async () => {
    const quiz = makeMultipleChoiceTask({ educatorId });
    taskRepository.getById.mockResolvedValue(quiz);

    const result = await useCase.execute({
      educatorId,
      id: quiz.id.value,
      type: TaskType.MultipleChoiceWithMedia,
      imageFile: `${BUCKET_URL}figura.png`,
    });

    expect(result.ok).toBe(true);
    const saved = taskRepository.save.mock.calls[0][0] as Task;
    expect(saved.type).toBe(TaskType.MultipleChoiceWithMedia);
    expect(saved.imageFile).toBe(`${BUCKET_URL}figura.png`);
  });

  it("AT-05: imageFile/audioFile enviados fora do armazenamento → INVALID_MEDIA_URL", async () => {
    const quiz = makeMultipleChoiceTask({ educatorId });
    taskRepository.getById.mockResolvedValue(quiz);

    const result = await useCase.execute({
      educatorId,
      id: quiz.id.value,
      type: TaskType.MultipleChoiceWithMedia,
      imageFile: `${BUCKET_URL}figura.png`,
      audioFile: "https://example.com/som.mp3",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INVALID_MEDIA_URL",
        errors: [{ field: "audioFile", message: expect.any(String) }],
      },
    });
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("TYPE_CHANGE_NOT_ALLOWED ao mudar o tipo", async () => {
    const task = makeWordBuilderTask({ educatorId });
    taskRepository.getById.mockResolvedValue(task);

    const result = await useCase.execute({
      educatorId,
      id: task.id.value,
      type: TaskType.MemoryGame,
    });

    expect(result).toEqual({ ok: false, error: "TYPE_CHANGE_NOT_ALLOWED" });
  });

  it("INVALID_CONTENT, ALTERNATIVES_NOT_ALLOWED, INVALID_SKILL e INVALID_MEDIA_URL", async () => {
    const task = makeWordBuilderTask({ educatorId });
    taskRepository.getById.mockResolvedValue(task);
    const id = task.id.value;

    expect(
      await useCase.execute({ educatorId, id, content: { kind: "wordBuilder", word: "" } })
    ).toEqual({
      ok: false,
      error: {
        code: "INVALID_CONTENT",
        errors: [{ field: "content.word", message: expect.any(String) }],
      },
    });
    expect(
      await useCase.execute({
        educatorId,
        id,
        alternatives: [{ text: "A", isCorrect: true }],
      })
    ).toEqual({ ok: false, error: "ALTERNATIVES_NOT_ALLOWED" });
    expect(await useCase.execute({ educatorId, id, skills: ["NAO_EXISTE"] })).toEqual({
      ok: false,
      error: "INVALID_SKILL",
    });
    expect(
      await useCase.execute({
        educatorId,
        id,
        content: { kind: "wordBuilder", word: "BOLA", hintAudioUrl: "https://x.com/a.mp3" },
      })
    ).toEqual({
      ok: false,
      error: {
        code: "INVALID_MEDIA_URL",
        errors: [{ field: "content.hintAudioUrl", message: expect.any(String) }],
      },
    });
    expect(taskRepository.save).not.toHaveBeenCalled();
  });

  it("atualiza content, skills, theme e tone do próprio educador", async () => {
    const task = makeWordBuilderTask({ educatorId });
    taskRepository.getById.mockResolvedValue(task);

    const result = await useCase.execute({
      educatorId,
      id: task.id.value,
      content: { kind: "wordBuilder", word: "GATO", hintImageUrl: `${BUCKET_URL}gato.png` },
      skills: ["VOCABULARIO"],
      theme: "Animais",
      tone: TaskTone.Yellow,
    });

    expect(result.ok).toBe(true);
    const saved = taskRepository.save.mock.calls[0][0] as Task;
    expect(saved.id.value).toBe(task.id.value);
    expect(saved.content).toEqual({
      kind: "wordBuilder",
      word: "GATO",
      hintImageUrl: `${BUCKET_URL}gato.png`,
    });
    expect(saved.skills).toEqual(["VOCABULARIO"]);
    expect(saved.theme).toBe("Animais");
    expect(saved.tone).toBe(TaskTone.Yellow);
    expect(saved.educatorId?.value).toBe(educatorId.value);
  });

  describe("null apaga a mídia (PP-05)", () => {
    const withMedia = () =>
      makeMultipleChoiceTask({
        educatorId,
        type: TaskType.MultipleChoiceWithMedia,
        imageFile: `${BUCKET_URL}figura.png`,
        audioFile: `${BUCKET_URL}som.mp3`,
      });

    it("null em imageFile apaga a imagem e mantém o áudio", async () => {
      const task = withMedia();
      taskRepository.getById.mockResolvedValue(task);

      const result = await useCase.execute({ educatorId, id: task.id.value, imageFile: null });

      expect(result.ok).toBe(true);
      const saved = taskRepository.save.mock.calls[0][0] as Task;
      expect(saved.imageFile).toBeUndefined();
      expect(saved.audioFile).toBe(`${BUCKET_URL}som.mp3`);
      expect(saved.type).toBe(TaskType.MultipleChoiceWithMedia);
    });

    it("ausente mantém as duas mídias", async () => {
      const task = withMedia();
      taskRepository.getById.mockResolvedValue(task);

      await useCase.execute({ educatorId, id: task.id.value, prompt: "Outro enunciado" });

      const saved = taskRepository.save.mock.calls[0][0] as Task;
      expect(saved.imageFile).toBe(`${BUCKET_URL}figura.png`);
      expect(saved.audioFile).toBe(`${BUCKET_URL}som.mp3`);
    });

    it("apagar a única mídia de uma múltipla escolha com mídia: MEDIA_TASK_REQUIRES_IMAGE_OR_AUDIO", async () => {
      const task = makeMultipleChoiceTask({
        educatorId,
        type: TaskType.MultipleChoiceWithMedia,
        imageFile: `${BUCKET_URL}figura.png`,
      });
      taskRepository.getById.mockResolvedValue(task);

      const result = await useCase.execute({ educatorId, id: task.id.value, imageFile: null });

      expect(result).toEqual({ ok: false, error: "MEDIA_TASK_REQUIRES_IMAGE_OR_AUDIO" });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it("apagar as mídias junto com type multipleChoice vira múltipla escolha sem mídia", async () => {
      const task = withMedia();
      taskRepository.getById.mockResolvedValue(task);

      const result = await useCase.execute({
        educatorId,
        id: task.id.value,
        type: TaskType.MultipleChoice,
        imageFile: null,
        audioFile: null,
      });

      expect(result.ok).toBe(true);
      const saved = taskRepository.save.mock.calls[0][0] as Task;
      expect(saved.type).toBe(TaskType.MultipleChoice);
      expect(saved.imageFile).toBeUndefined();
      expect(saved.audioFile).toBeUndefined();
    });
  });
});

describe("updateTaskSchema (PP-05)", () => {
  it("aceita null em imageFile e audioFile; ausente continua ausente", () => {
    const id = Uuid.random().value;
    expect(updateTaskSchema.safeParse({ id, imageFile: null, audioFile: null }).data).toEqual({
      id,
      imageFile: null,
      audioFile: null,
    });
    expect(updateTaskSchema.safeParse({ id }).data).toEqual({ id });
  });
});
