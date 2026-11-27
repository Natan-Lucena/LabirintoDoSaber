import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Task,
  TaskCategory,
  TaskFormat,
  TaskSource,
  TaskTone,
  TaskType,
} from "../../../../../domain/entities/task";
import { CreateTaskUseCase } from "./create-task-use-case";
import {
  BUCKET_URL,
  makeFileStorage,
  makeSkillRepository,
  makeTaskRepository,
} from "../test-fixtures";

const mockImageFile = {
  fieldname: "imageFile",
  originalname: "image.png",
  encoding: "7bit",
  mimetype: "image/png",
  buffer: Buffer.from("fake image buffer"),
  size: 1234,
} as Express.Multer.File;

const alternatives = [
  { text: "Paris", isCorrect: true },
  { text: "Londres", isCorrect: false },
];

describe("CreateTaskUseCase", () => {
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let fileStorage: ReturnType<typeof makeFileStorage>;
  let skillRepository: ReturnType<typeof makeSkillRepository>;
  let useCase: CreateTaskUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    taskRepository = makeTaskRepository();
    fileStorage = makeFileStorage();
    skillRepository = makeSkillRepository();
    useCase = new CreateTaskUseCase(taskRepository, fileStorage, skillRepository);
  });

  const savedTask = () => taskRepository.save.mock.calls[0][0] as Task;

  describe("múltipla escolha (como antes)", () => {
    it("falha se MultipleChoice tem mídia", async () => {
      const result = await useCase.execute({
        educatorId,
        category: TaskCategory.Reading,
        type: TaskType.MultipleChoice,
        prompt: "Qual é a capital da França?",
        alternatives,
        imageFile: mockImageFile,
      });

      expect(result).toEqual({ ok: false, error: "TEXT_TASK_CANNOT_HAVE_MEDIA" });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it("falha se MultipleChoiceWithMedia não tem mídia", async () => {
      const result = await useCase.execute({
        educatorId,
        category: TaskCategory.Reading,
        type: TaskType.MultipleChoiceWithMedia,
        prompt: "Qual é a capital da França?",
        alternatives,
      });

      expect(result).toEqual({ ok: false, error: "MEDIA_TASK_REQUIRES_IMAGE_OR_AUDIO" });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it("falha sem alternativa correta", async () => {
      const result = await useCase.execute({
        educatorId,
        category: TaskCategory.Reading,
        type: TaskType.MultipleChoice,
        prompt: "Qual é a capital da França?",
        alternatives: alternatives.map((alt) => ({ ...alt, isCorrect: false })),
      });

      expect(result).toEqual({ ok: false, error: "AT_LEAST_ONE_ALTERNATIVE_MUST_BE_CORRECT" });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it("cria e devolve a Task com os campos novos", async () => {
      const result = await useCase.execute({
        educatorId,
        category: TaskCategory.Reading,
        type: TaskType.MultipleChoice,
        prompt: "Qual é a capital da França?",
        alternatives,
      });

      expect(result.ok).toBe(true);
      const task = savedTask();
      expect(result).toEqual({ ok: true, value: task });
      expect(task.prompt).toBe("Qual é a capital da França?");
      expect(task.format).toBe(TaskFormat.Interactive);
      expect(task.source).toBe(TaskSource.Educator);
      expect(task.educatorId?.value).toBe(educatorId.value);
      expect(task.skills).toEqual([]);
      expect(Object.values(TaskTone)).toContain(task.tone);
    });

    it("sobe a mídia de MultipleChoiceWithMedia", async () => {
      const result = await useCase.execute({
        educatorId,
        category: TaskCategory.Reading,
        type: TaskType.MultipleChoiceWithMedia,
        prompt: "Qual é a capital da França?",
        alternatives,
        imageFile: mockImageFile,
      });

      expect(result.ok).toBe(true);
      expect(savedTask().imageFile).toBe(`${BUCKET_URL}uploaded.png`);
    });
  });

  describe("tipos novos", () => {
    const wordBuilder = {
      category: TaskCategory.Writing,
      type: TaskType.WordBuilder,
      prompt: "Monte a palavra",
    };

    it("BE-AT-01: wordBuilder sem content.word → INVALID_CONTENT com o campo", async () => {
      const result = await useCase.execute({
        educatorId,
        ...wordBuilder,
        content: { kind: "wordBuilder" },
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "INVALID_CONTENT",
          errors: [{ field: "content.word", message: expect.any(String) }],
        },
      });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it("ALTERNATIVES_NOT_ALLOWED quando envia alternativas", async () => {
      const result = await useCase.execute({
        educatorId,
        ...wordBuilder,
        content: { kind: "wordBuilder", word: "BOLA" },
        alternatives,
      });

      expect(result).toEqual({ ok: false, error: "ALTERNATIVES_NOT_ALLOWED" });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it("arquivo enviado num tipo novo é INVALID_CONTENT e nada sobe", async () => {
      const result = await useCase.execute({
        educatorId,
        ...wordBuilder,
        content: { kind: "wordBuilder", word: "BOLA" },
        imageFile: mockImageFile,
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "INVALID_CONTENT",
          errors: [{ field: "imageFile", message: expect.any(String) }],
        },
      });
      expect(fileStorage.saveFile).not.toHaveBeenCalled();
    });

    it("INVALID_SKILL com código fora do catálogo", async () => {
      const result = await useCase.execute({
        educatorId,
        ...wordBuilder,
        content: { kind: "wordBuilder", word: "BOLA" },
        skills: ["VOCABULARIO", "NAO_EXISTE"],
      });

      expect(result).toEqual({ ok: false, error: "INVALID_SKILL" });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it("INVALID_MEDIA_URL com URL de fora do armazenamento", async () => {
      const result = await useCase.execute({
        educatorId,
        ...wordBuilder,
        content: {
          kind: "wordBuilder",
          word: "BOLA",
          hintImageUrl: "https://example.com/bola.png",
        },
      });

      expect(result).toEqual({
        ok: false,
        error: {
          code: "INVALID_MEDIA_URL",
          errors: [{ field: "content.hintImageUrl", message: expect.any(String) }],
        },
      });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it("cria wordBuilder com mídia do armazenamento, skills, theme e tone", async () => {
      const result = await useCase.execute({
        educatorId,
        ...wordBuilder,
        content: {
          kind: "wordBuilder",
          word: "bola",
          hintImageUrl: `${BUCKET_URL}bola.png`,
          hintAudioUrl: `${BUCKET_URL}bola.mp3`,
        },
        skills: ["VOCABULARIO"],
        theme: "Brinquedos",
        tone: TaskTone.Lavender,
      });

      expect(result.ok).toBe(true);
      const task = savedTask();
      expect(task.content).toEqual({
        kind: "wordBuilder",
        word: "BOLA",
        hintImageUrl: `${BUCKET_URL}bola.png`,
        hintAudioUrl: `${BUCKET_URL}bola.mp3`,
      });
      expect(task.skills).toEqual(["VOCABULARIO"]);
      expect(task.theme).toBe("Brinquedos");
      expect(task.tone).toBe(TaskTone.Lavender);
      expect(task.educatorId?.value).toBe(educatorId.value);
    });

    it("cria imprimível com formato PRINTABLE", async () => {
      const result = await useCase.execute({
        educatorId,
        category: TaskCategory.Comprehension,
        type: TaskType.Printable,
        prompt: "Faça no papel",
        content: {
          kind: "printable",
          title: "Complete a sequência",
          instructions: "Escreva o que falta",
          layout: "SEQUENCE",
          items: [{ id: "1", text: "2, 4, __", answerLines: 1 }],
        },
      });

      expect(result.ok).toBe(true);
      expect(savedTask().format).toBe(TaskFormat.Printable);
    });
  });
});
