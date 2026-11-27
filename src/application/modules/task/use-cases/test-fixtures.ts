// Entidades reais e repositórios simulados para os specs do banco de atividades.
import { vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  CreateTaskProps,
  Task,
  TaskCategory,
  TaskSource,
  TaskType,
} from "../../../../domain/entities/task";
import { TaskSkill } from "../../../../domain/entities/task-skill";
import { TaskRepository } from "../../../../domain/repositories/task-repository";
import { TaskSkillRepository } from "../../../../domain/repositories/task-skill-repository";
import { FileStorage } from "../../../services/file-storage";

export const BUCKET_URL = "https://bucket.s3.sa-east-1.amazonaws.com/";

export const unwrapTask = (result: ReturnType<typeof Task.create>): Task => {
  if (!result.ok) throw new Error(`fixture inválida: ${JSON.stringify(result.error)}`);
  return result.value;
};

export const makeMultipleChoiceTask = (extra: Partial<CreateTaskProps> = {}) =>
  unwrapTask(
    Task.create({
      category: TaskCategory.Reading,
      type: TaskType.MultipleChoice,
      prompt: "Qual palavra rima com gato?",
      alternatives: [
        { text: "Pato", isCorrect: true },
        { text: "Casa", isCorrect: false },
      ],
      ...extra,
    })
  );

export const makeWordBuilderTask = (extra: Partial<CreateTaskProps> = {}) =>
  unwrapTask(
    Task.create({
      category: TaskCategory.Writing,
      type: TaskType.WordBuilder,
      prompt: "Monte a palavra da figura",
      content: { kind: "wordBuilder", word: "BOLA" },
      ...extra,
    })
  );

export const makePrintableTask = (extra: Partial<CreateTaskProps> = {}) =>
  unwrapTask(
    Task.create({
      category: TaskCategory.Comprehension,
      type: TaskType.Printable,
      prompt: "Complete no papel",
      content: {
        kind: "printable",
        title: "Complete a sequência",
        instructions: "Escreva o número que falta",
        layout: "SEQUENCE",
        items: [{ id: "1", text: "1, 2, __", answerLines: 1 }],
      },
      ...extra,
    })
  );

export const makeLibraryTask = (extra: Partial<CreateTaskProps> = {}) =>
  makeWordBuilderTask({ source: TaskSource.Library, ...extra });

export const makeSkill = (code: string, label: string, learningTopics: string[], order = 1) => {
  const created = TaskSkill.create({ code, label, learningTopics, order });
  if (!created.ok) throw new Error(`skill inválida: ${code}`);
  return created.value;
};

export const SKILLS = [
  makeSkill("CONSCIENCIA_FONOLOGICA", "Consciência fonológica", ["Consciência fonológica", "alfabetização"], 1),
  makeSkill("VOCABULARIO", "Vocabulário", ["vocabulário", "linguagem"], 2),
  makeSkill("ATENCAO_VISUAL", "Atenção visual", ["atenção", "TDAH"], 3),
];

export const makeTaskRepository = () =>
  ({
    save: vi.fn(),
    saveMany: vi.fn(),
    getById: vi.fn(),
    getByIds: vi.fn().mockResolvedValue([]),
    listByEducator: vi.fn().mockResolvedValue([]),
    listLibrary: vi.fn().mockResolvedValue([]),
    findLegacyOwners: vi.fn(async () => new Map<string, string[]>()),
    delete: vi.fn(),
  }) satisfies Record<keyof TaskRepository, unknown> as unknown as TaskRepository & {
    [K in keyof TaskRepository]: ReturnType<typeof vi.fn>;
  };

export const makeSkillRepository = (skills = SKILLS) =>
  ({
    listAll: vi.fn().mockResolvedValue(skills),
    save: vi.fn(),
  }) as unknown as TaskSkillRepository & {
    [K in keyof TaskSkillRepository]: ReturnType<typeof vi.fn>;
  };

export const makeFileStorage = () =>
  ({
    saveFile: vi.fn().mockResolvedValue({ url: `${BUCKET_URL}uploaded.png` }),
    isStoredFileUrl: vi.fn((url: string) => url.startsWith(BUCKET_URL)),
  }) as unknown as FileStorage & { [K in keyof FileStorage]: ReturnType<typeof vi.fn> };

export const educatorId = () => Uuid.random();
