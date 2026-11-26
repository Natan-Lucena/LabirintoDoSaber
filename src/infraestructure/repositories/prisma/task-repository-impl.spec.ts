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

  describe("listByEducator e findLegacyOwners", () => {
    const educatorId = Uuid.random();
    const otherId = Uuid.random();
    const own = makeWordBuilderTask({ educatorId });
    const othersTask = makeWordBuilderTask({ educatorId: otherId });
    const library = makeLibraryTask();
    const loose = legacyRecord(); // legado avulso
    const inMyGroup = legacyRecord();
    const inMyOldNotebook = { ...legacyRecord(), notebookId: "nb-mine" }; // relação antiga
    const inOthersNotebook = legacyRecord();
    const toRecord = (task: typeof own) => ({
      ...JSON.parse(JSON.stringify(task)),
      educatorId: task.educatorId?.value ?? null,
      category: "Writing",
      type: "WordBuilder",
      createdAt: task.createdAt,
      notebookId: null,
      imageFile: null,
      audioFile: null,
    });

    const makePrisma = () => {
      const notebooks = [
        { id: "nb-mine", educatorId: educatorId.value, taskIds: [] as string[] },
        {
          id: "nb-other",
          educatorId: otherId.value,
          taskIds: [inOthersNotebook.id, library.id.value],
        },
      ];
      const groups = [{ educatorId: educatorId.value, taskIds: [inMyGroup.id] }];
      const records = [own, othersTask, library]
        .map(toRecord)
        .concat([loose, inMyGroup, inMyOldNotebook, inOthersNotebook]);

      const taskFindMany = vi.fn(async ({ where, select }: any) => {
        if (where.id) {
          const found = records.filter((record) => where.id.in.includes(record.id));
          return select ? found.map(({ id, notebookId }) => ({ id, notebookId })) : found;
        }
        // Simula o filtro: do educador ou sem dono.
        return records.filter(
          (record) => record.educatorId === educatorId.value || record.educatorId === null
        );
      });
      const notebookFindMany = vi.fn(async ({ where }: any) => {
        const [byId, byTaskIds] = where.OR;
        return notebooks.filter(
          (notebook) =>
            byId.id.in.includes(notebook.id) ||
            notebook.taskIds.some((id) => byTaskIds.taskIds.hasSome.includes(id))
        );
      });
      const groupFindMany = vi.fn(async ({ where }: any) =>
        groups.filter((group) => group.taskIds.some((id) => where.taskIds.hasSome.includes(id)))
      );
      return {
        prisma: {
          task: { findMany: taskFindMany },
          taskNotebook: { findMany: notebookFindMany },
          taskGroup: { findMany: groupFindMany },
        } as unknown as PrismaClient,
        taskFindMany,
        notebookFindMany,
        groupFindMany,
      };
    };

    it("traz as próprias, o legado avulso e o legado nos cadernos/grupos do educador", async () => {
      const mock = makePrisma();

      const tasks = await new TaskRepositoryImpl(mock.prisma).listByEducator(educatorId);

      expect(tasks.map((task) => task.id.value).sort()).toEqual(
        [own.id.value, loose.id, inMyGroup.id, inMyOldNotebook.id].sort()
      );
      expect(mock.taskFindMany.mock.calls[0][0].where.OR).toEqual([
        { educatorId: educatorId.value },
        { educatorId: null },
        { educatorId: { isSet: false } },
      ]);
      // Sem N+1: uma busca de tarefas, uma de cadernos e uma de grupos.
      expect(mock.taskFindMany).toHaveBeenCalledTimes(1);
      expect(mock.notebookFindMany).toHaveBeenCalledTimes(1);
      expect(mock.groupFindMany).toHaveBeenCalledTimes(1);
    });

    it("o legado avulso aparece para qualquer educador", async () => {
      const mock = makePrisma();
      const stranger = Uuid.random();

      const tasks = await new TaskRepositoryImpl(mock.prisma).listByEducator(stranger);

      expect(tasks.map((task) => task.id.value)).toEqual([loose.id]);
    });

    it("findLegacyOwners devolve os donos dos cadernos (taskIds e relação) e grupos", async () => {
      const mock = makePrisma();

      const owners = await new TaskRepositoryImpl(mock.prisma).findLegacyOwners(
        [loose, inMyGroup, inMyOldNotebook, inOthersNotebook].map(({ id }) => new Uuid(id))
      );

      expect(owners.get(loose.id)).toEqual([]);
      expect(owners.get(inMyGroup.id)).toEqual([educatorId.value]);
      expect(owners.get(inMyOldNotebook.id)).toEqual([educatorId.value]);
      expect(owners.get(inOthersNotebook.id)).toEqual([otherId.value]);
    });
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
