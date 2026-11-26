import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Task,
  TaskCategory,
  TaskFormat,
  TaskSource,
  TaskType,
} from "../../../../../domain/entities/task";
import { ListTaskCatalogUseCase } from "./list-task-catalog-use-case";
import { encodeTaskCatalogCursor } from "./task-catalog-cursor";
import {
  BUCKET_URL,
  makeLibraryTask,
  makeMultipleChoiceTask,
  makePrintableTask,
  makeSkillRepository,
  makeTaskRepository,
  makeWordBuilderTask,
} from "../test-fixtures";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 1, 12, minutes));

describe("ListTaskCatalogUseCase", () => {
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let useCase: ListTaskCatalogUseCase;
  const educatorId = Uuid.random();

  let libraryPrintable: Task;
  let libraryWord: Task;
  let ownQuiz: Task;
  let ownWord: Task;

  beforeEach(() => {
    taskRepository = makeTaskRepository();
    useCase = new ListTaskCatalogUseCase(taskRepository, makeSkillRepository());

    libraryPrintable = makePrintableTask({
      source: TaskSource.Library,
      createdAt: at(1),
      skills: ["ATENCAO_VISUAL"],
    });
    libraryWord = makeLibraryTask({
      createdAt: at(2),
      theme: "Brinquedos",
      skills: ["CONSCIENCIA_FONOLOGICA"],
      content: { kind: "wordBuilder", word: "PIÃO", hintImageUrl: `${BUCKET_URL}piao.png` },
    });
    ownQuiz = makeMultipleChoiceTask({
      educatorId,
      createdAt: at(3),
      prompt: "Qual animal faz miau?",
    });
    ownWord = makeWordBuilderTask({ educatorId, createdAt: at(4), skills: ["VOCABULARIO"] });

    taskRepository.listLibrary.mockResolvedValue([libraryPrintable, libraryWord]);
    taskRepository.listByEducator.mockResolvedValue([ownQuiz, ownWord]);
  });

  const ids = (result: Awaited<ReturnType<ListTaskCatalogUseCase["execute"]>>) => {
    if (!result.ok) throw new Error(`falhou: ${result.error}`);
    return result.value.items.map((item) => item.id);
  };

  it("sem source traz biblioteca e as do educador, mais recentes primeiro", async () => {
    const result = await useCase.execute({ educatorId, limit: 20 });

    expect(ids(result)).toEqual([ownWord, ownQuiz, libraryWord, libraryPrintable].map((t) => t.id.value));
    expect(taskRepository.listByEducator).toHaveBeenCalledWith(educatorId);
    if (result.ok) expect(result.value.nextCursor).toBeUndefined();
  });

  it("BE-AT-02: format=PRINTABLE só imprimíveis; source=LIBRARY só biblioteca", async () => {
    const printable = await useCase.execute({ educatorId, limit: 20, format: TaskFormat.Printable });
    expect(ids(printable)).toEqual([libraryPrintable.id.value]);
    expect(taskRepository.listByEducator).toHaveBeenCalledTimes(1);

    // source=LIBRARY nem consulta as tarefas do educador.
    const library = await useCase.execute({ educatorId, limit: 20, source: TaskSource.Library });
    expect(ids(library)).toEqual([libraryWord.id.value, libraryPrintable.id.value]);
    expect(taskRepository.listByEducator).toHaveBeenCalledTimes(1);

    const own = await useCase.execute({ educatorId, limit: 20, source: TaskSource.Educator });
    expect(ids(own)).toEqual([ownWord.id.value, ownQuiz.id.value]);
  });

  it("filtra por tipo, habilidade e categoria", async () => {
    expect(ids(await useCase.execute({ educatorId, limit: 20, type: TaskType.WordBuilder }))).toEqual([
      ownWord.id.value,
      libraryWord.id.value,
    ]);
    expect(ids(await useCase.execute({ educatorId, limit: 20, skill: "VOCABULARIO" }))).toEqual([
      ownWord.id.value,
    ]);
    expect(
      ids(await useCase.execute({ educatorId, limit: 20, category: TaskCategory.Reading }))
    ).toEqual([ownQuiz.id.value]);
  });

  it("AT-09: busca sem acento e maiúscula em prompt, theme, título e rótulo da habilidade", async () => {
    const search = (term: string) => useCase.execute({ educatorId, limit: 20, search: term });

    expect(ids(await search("MIAU"))).toEqual([ownQuiz.id.value]); // prompt
    expect(ids(await search("brinquedos"))).toEqual([libraryWord.id.value]); // theme
    expect(ids(await search("piao"))).toEqual([libraryWord.id.value]); // título (palavra)
    expect(ids(await search("sequencia"))).toEqual([libraryPrintable.id.value]); // título do imprimível
    expect(ids(await search("consciencia fonologica"))).toEqual([libraryWord.id.value]); // rótulo
  });

  it("monta o TaskSummary", async () => {
    const result = await useCase.execute({ educatorId, limit: 20, source: TaskSource.Library });
    if (!result.ok) throw new Error("falhou");

    expect(result.value.items[0]).toEqual({
      id: libraryWord.id.value,
      type: "wordBuilder",
      format: "INTERACTIVE",
      source: "LIBRARY",
      category: "writing",
      title: "PIÃO",
      skills: [{ code: "CONSCIENCIA_FONOLOGICA", label: "Consciência fonológica" }],
      theme: "Brinquedos",
      tone: libraryWord.tone,
      thumbnailUrl: `${BUCKET_URL}piao.png`,
    });
  });

  it("pagina por cursor sem repetir nem pular", async () => {
    const first = await useCase.execute({ educatorId, limit: 3 });
    if (!first.ok) throw new Error("falhou");
    expect(first.value.items).toHaveLength(3);
    expect(first.value.nextCursor).toBe(
      encodeTaskCatalogCursor({ createdAt: libraryWord.createdAt, id: libraryWord.id.value })
    );

    const second = await useCase.execute({
      educatorId,
      limit: 3,
      cursor: first.value.nextCursor,
    });
    expect(ids(second)).toEqual([libraryPrintable.id.value]);
    if (second.ok) expect(second.value.nextCursor).toBeUndefined();
  });

  it("INVALID_CURSOR com cursor ilegível", async () => {
    expect(await useCase.execute({ educatorId, limit: 20, cursor: "lixo" })).toEqual({
      ok: false,
      error: "INVALID_CURSOR",
    });
  });
});
