import { describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { TaskRepositoryImpl } from "./task-repository-impl";
import { TaskNotebookRepositoryImpl } from "./task-notebook-repository-impl";
import { TaskSource, TaskTone, toneForId } from "../../../domain/entities/task";
import {
  makeLibraryTask,
  makeWordBuilderTask,
} from "../../../application/modules/task/use-cases/test-fixtures";

// Documento como as tarefas antigas estão no banco: sem os campos novos.
const legacyRecord = (id = Uuid.random().value) => ({
  id,
  category: "Reading",
  type: "MultipleChoice",
  prompt: "Qual palavra rima com gato?",
  alternatives: [
    { id: Uuid.random().value, text: "Pato", isCorrect: true },
    { id: Uuid.random().value, text: "Casa", isCorrect: false },
  ],
  imageFile: null,
  audioFile: null,
  createdAt: new Date("2026-01-10T12:00:00.000Z"),
  notebookId: null,
  source: null,
  educatorId: null,
  skills: [],
  theme: null,
  tone: null,
  content: null,
});

describe("TaskRepositoryImpl", () => {
  it("BE-AT-06: tarefa antiga ganha os defaults na leitura", async () => {
    const record = legacyRecord();
    const prisma = {
      task: { findUnique: vi.fn().mockResolvedValue(record) },
    } as unknown as PrismaClient;

    const task = await new TaskRepositoryImpl(prisma).getById(new Uuid(record.id));

    expect(task).not.toBeNull();
    expect(task!.source).toBe(TaskSource.Educator);
    expect(task!.skills).toEqual([]);
    expect(task!.tone).toBe(toneForId(new Uuid(record.id)));
    expect(task!.content).toBeUndefined();
    expect(task!.educatorId).toBeUndefined();
    expect(task!.format).toBe("INTERACTIVE");
    expect(task!.alternatives).toHaveLength(2);
  });

  it("grava os campos novos e devolve a tarefa igual na leitura", async () => {
    const upsert = vi.fn();
    const prisma = { task: { upsert } } as unknown as PrismaClient;
    const educatorId = Uuid.random();
    const task = makeWordBuilderTask({
      educatorId,
      skills: ["VOCABULARIO"],
      theme: "Brinquedos",
      tone: TaskTone.Mint,
    });

    await new TaskRepositoryImpl(prisma).save(task);

    const { create, update } = upsert.mock.calls[0][0];
    expect(create).toMatchObject({
      id: task.id.value,
      type: "WordBuilder",
      source: "EDUCATOR",
      educatorId: educatorId.value,
      skills: ["VOCABULARIO"],
      theme: "Brinquedos",
      tone: "mint",
      content: { kind: "wordBuilder", word: "BOLA" },
      alternatives: [],
    });
    expect(update).not.toHaveProperty("id");

    const read = await new TaskRepositoryImpl({
      task: { findUnique: vi.fn().mockResolvedValue({ ...create, notebookId: null }) },
    } as unknown as PrismaClient).getById(task.id);
    expect(JSON.stringify(read)).toBe(JSON.stringify(task));
  });

  it("listByEducator: próprias + antigas sem dono dos cadernos e grupos, sem a biblioteca", async () => {
    const educatorId = Uuid.random();
    const own = makeWordBuilderTask({ educatorId });
    const library = makeLibraryTask();
    const legacy = legacyRecord();
    const toRecord = (task: typeof own) => ({
      ...JSON.parse(JSON.stringify(task)),
      category: "Writing",
      type: "WordBuilder",
      createdAt: task.createdAt,
      notebookId: null,
      imageFile: null,
      audioFile: null,
    });

    const findMany = vi.fn().mockResolvedValue([toRecord(own), toRecord(library), legacy]);
    const prisma = {
      taskNotebook: {
        findMany: vi.fn().mockResolvedValue([{ id: "nb-1", taskIds: [library.id.value] }]),
      },
      taskGroup: { findMany: vi.fn().mockResolvedValue([{ taskIds: [legacy.id] }]) },
      task: { findMany },
    } as unknown as PrismaClient;

    const tasks = await new TaskRepositoryImpl(prisma).listByEducator(educatorId);

    expect(tasks.map((task) => task.id.value)).toEqual([own.id.value, legacy.id]);
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR[0]).toEqual({ educatorId: educatorId.value });
    expect(where.OR[1].AND[1].OR).toEqual([
      { id: { in: [library.id.value, legacy.id] } },
      { notebookId: { in: ["nb-1"] } },
    ]);
  });
});

describe("TaskNotebookRepositoryImpl", () => {
  const educator = {
    id: Uuid.random().value,
    name: "Educadora",
    email: "edu@example.com",
    password: "hash",
    createdAt: new Date(),
    photoUrl: null,
    contact: null,
    profession: null,
  };

  it("junta a relação antiga com taskIds numa busca só", async () => {
    const legacy = legacyRecord();
    const fromIds = legacyRecord();
    const findMany = vi.fn().mockResolvedValue([fromIds]);
    const prisma = {
      taskNotebook: {
        findUnique: vi.fn().mockResolvedValue({
          id: Uuid.random().value,
          educatorId: educator.id,
          educator,
          tasks: [legacy],
          taskIds: [fromIds.id, legacy.id],
          category: "Reading",
          description: "Caderno",
          taskGroupsIds: [],
          createdAt: new Date(),
        }),
      },
      task: { findMany },
    } as unknown as PrismaClient;

    const notebook = await new TaskNotebookRepositoryImpl(prisma).getById(Uuid.random());

    expect(notebook!.tasks.map((task) => task.id.value)).toEqual([fromIds.id, legacy.id]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0]).toEqual({ where: { id: { in: [fromIds.id] } } });
  });

  it("grava as tarefas em taskIds (a mesma da biblioteca pode estar em vários cadernos)", async () => {
    const library = makeLibraryTask();
    const upsert = vi.fn().mockResolvedValue({
      id: Uuid.random().value,
      educatorId: educator.id,
      educator,
      tasks: [],
      taskIds: [library.id.value],
      category: "Writing",
      description: "Caderno",
      taskGroupsIds: [],
      createdAt: new Date(),
    });
    const prisma = {
      taskNotebook: { upsert },
      task: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const { TaskNotebook, TaskNotebookCategory } = await import(
      "../../../domain/entities/task-notebook"
    );
    const { Educator } = await import("../../../domain/entities/educator");
    const created = TaskNotebook.create({
      educator: Educator.create({ name: "E", email: "e@x.com", password: "h" }),
      category: TaskNotebookCategory.Writing,
      description: "Caderno",
      tasks: [library],
    });
    if (!created.ok) throw new Error("fixture");

    await new TaskNotebookRepositoryImpl(prisma).save(created.value);

    const { create, update } = upsert.mock.calls[0][0];
    expect(create.taskIds).toEqual([library.id.value]);
    expect(update.taskIds).toEqual([library.id.value]);
    expect(create).not.toHaveProperty("tasks");
    expect(update).not.toHaveProperty("tasks");
  });
});
