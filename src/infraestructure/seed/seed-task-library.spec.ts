import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { TaskFormat, TaskSource, TaskType } from "../../domain/entities/task";
import { normalizeText } from "../../domain/utils/text";
import {
  libraryTaskId,
  loadTaskLibraryFiles,
  seedTaskLibrary,
  TaskLibrarySeedError,
} from "./seed-task-library";
import { mapPrismaTaskToEntity } from "../repositories/prisma/task-repository-impl";

const LIBRARY_DIR = path.resolve(__dirname, "../../../task-library");

// Prisma simulado com coleções em memória (nada de banco real).
const makePrisma = () => {
  const skills = new Map<string, any>();
  const tasks = new Map<string, any>();

  const upsertInto = (store: Map<string, any>) =>
    vi.fn(async ({ where, create, update }: any) => {
      const current = store.get(where.id);
      // structuredClone mantém Date como no driver.
      store.set(where.id, structuredClone(current ? { ...current, ...update } : create));
    });

  const taskSkill = {
    findMany: vi.fn(async () =>
      [...skills.values()].sort((a, b) => a.order - b.order).map((r) => structuredClone(r))
    ),
    upsert: upsertInto(skills),
  };
  const task = {
    findMany: vi.fn(async ({ where }: any) =>
      [...tasks.values()]
        .filter((record) => where.id.in.includes(record.id))
        .map((record) => structuredClone(record))
    ),
    upsert: upsertInto(tasks),
  };

  return {
    prisma: { taskSkill, task } as unknown as PrismaClient,
    taskSkill,
    task,
    skills,
    tasks,
  };
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("seedTaskLibrary", () => {
  let mock: ReturnType<typeof makePrisma>;
  const files = loadTaskLibraryFiles(LIBRARY_DIR);

  beforeEach(() => {
    mock = makePrisma();
  });

  it("carrega habilidades e biblioteca na primeira vez", async () => {
    const report = await seedTaskLibrary(mock.prisma, files);

    expect(report.skills.created.length).toBe((files.skills as unknown[]).length);
    expect(report.tasks.created.length).toBe((files.tasks as unknown[]).length);
    expect(mock.skills.size).toBe(report.skills.created.length);
    expect(mock.tasks.size).toBe(report.tasks.created.length);
  });

  it("é idempotente: rodar de novo não grava nada", async () => {
    await seedTaskLibrary(mock.prisma, files);
    const writes = mock.task.upsert.mock.calls.length + mock.taskSkill.upsert.mock.calls.length;

    const report = await seedTaskLibrary(mock.prisma, files);

    expect(report.skills.created).toEqual([]);
    expect(report.skills.updated).toEqual([]);
    expect(report.tasks.created).toEqual([]);
    expect(report.tasks.updated).toEqual([]);
    expect(report.tasks.unchanged.length).toBe((files.tasks as unknown[]).length);
    expect(mock.task.upsert.mock.calls.length + mock.taskSkill.upsert.mock.calls.length).toBe(
      writes
    );
  });

  it("atualiza a tarefa que mudou no arquivo, mantendo id e criação", async () => {
    await seedTaskLibrary(mock.prisma, files);
    const changed = clone(files);
    (changed.tasks as any[])[0].prompt = "Instrução revista";
    const id = libraryTaskId((changed.tasks as any[])[0].key).value;
    const createdAt = mock.tasks.get(id).createdAt;

    const report = await seedTaskLibrary(mock.prisma, changed);

    expect(report.tasks.updated).toEqual([(changed.tasks as any[])[0].key]);
    expect(mock.tasks.get(id).prompt).toBe("Instrução revista");
    expect(mock.tasks.get(id).createdAt).toEqual(createdAt);
  });

  it("aborta sem gravar quando uma tarefa usa habilidade fora do catálogo", async () => {
    const invalid = clone(files);
    (invalid.tasks as any[])[0].skills = ["NAO_EXISTE"];

    await expect(seedTaskLibrary(mock.prisma, invalid)).rejects.toThrow(/INVALID_SKILL/);
    expect(mock.task.upsert).not.toHaveBeenCalled();
    expect(mock.taskSkill.upsert).not.toHaveBeenCalled();
  });

  it("aborta com o campo do content inválido", async () => {
    const invalid = clone(files);
    const wordBuilder = (invalid.tasks as any[]).find((task) => task.type === "wordBuilder");
    delete wordBuilder.content.word;

    await expect(seedTaskLibrary(mock.prisma, invalid)).rejects.toThrow(
      /INVALID_CONTENT: content\.word/
    );
    expect(mock.task.upsert).not.toHaveBeenCalled();
  });

  it("aborta com mídia na biblioteca e com chave repetida", async () => {
    const withMedia = clone(files);
    const wordBuilder = (withMedia.tasks as any[]).find((task) => task.type === "wordBuilder");
    wordBuilder.content.hintImageUrl = "https://example.com/x.png";
    await expect(seedTaskLibrary(mock.prisma, withMedia)).rejects.toThrow(/MEDIA_NOT_ALLOWED/);

    const duplicated = clone(files);
    (duplicated.tasks as any[]).push((duplicated.tasks as any[])[0]);
    await expect(seedTaskLibrary(mock.prisma, duplicated)).rejects.toThrow(TaskLibrarySeedError);
    await expect(seedTaskLibrary(mock.prisma, duplicated)).rejects.toThrow(/DUPLICATE_KEY/);
  });
});

describe("arquivos de task-library/ (AT-06, AT-12)", () => {
  const files = loadTaskLibraryFiles(LIBRARY_DIR);

  const seeded = async () => {
    const mock = makePrisma();
    await seedTaskLibrary(mock.prisma, files);
    return [...mock.tasks.values()].map(mapPrismaTaskToEntity);
  };

  it("biblioteca tem pelo menos 3 de cada jogo novo e 5 imprimíveis, todas LIBRARY", async () => {
    const tasks = await seeded();
    const count = (type: TaskType) => tasks.filter((task) => task.type === type).length;

    expect(count(TaskType.WordBuilder)).toBeGreaterThanOrEqual(3);
    expect(count(TaskType.ColorMatch)).toBeGreaterThanOrEqual(3);
    expect(count(TaskType.MemoryGame)).toBeGreaterThanOrEqual(3);
    expect(count(TaskType.Printable)).toBeGreaterThanOrEqual(5);
    expect(tasks.filter((task) => task.format === TaskFormat.Printable)).toHaveLength(
      count(TaskType.Printable)
    );
    for (const task of tasks) {
      expect(task.source).toBe(TaskSource.Library);
      expect(task.educatorId).toBeUndefined();
      expect(task.mediaUrls).toEqual([]);
      expect(task.skills.length).toBeGreaterThan(0);
    }
  });

  it("toda habilidade tem learningTopics e casa com temas sem acento/maiúscula", async () => {
    const mock = makePrisma();
    await seedTaskLibrary(mock.prisma, files);
    const records = [...mock.skills.values()];

    expect(records.length).toBeGreaterThanOrEqual(10);
    for (const record of records) expect(record.learningTopics.length).toBeGreaterThan(0);

    const topics = records.flatMap((record) => record.learningTopics.map(normalizeText));
    expect(topics).toContain(normalizeText("ALFABETIZACAO"));
    expect(topics).toContain(normalizeText("Compreensão de texto"));
  });
});
