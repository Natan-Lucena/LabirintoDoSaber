import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Task,
  TaskCategory,
  TaskFormat,
  TaskSource,
  TaskTone,
  TaskType,
  toneForId,
} from "../../entities/task";

const unwrap = (result: ReturnType<typeof Task.create>): Task => {
  if (!result.ok) throw new Error(`unexpected ${JSON.stringify(result.error)}`);
  return result.value;
};

const fieldsOf = (result: ReturnType<typeof Task.create>) => {
  if (result.ok || typeof result.error !== "object") {
    throw new Error(`expected INVALID_CONTENT, got ${JSON.stringify(result)}`);
  }
  expect(result.error.code).toBe("INVALID_CONTENT");
  return result.error.errors.map((error) => error.field);
};

const base = {
  category: TaskCategory.Writing,
  prompt: "Monte a palavra",
};

const wordBuilder = (content: unknown) =>
  Task.create({ ...base, type: TaskType.WordBuilder, content });

describe("Task: tipos novos", () => {
  describe("formato derivado (AT-03)", () => {
    it.each([
      [TaskType.WordBuilder, { kind: "wordBuilder", word: "BOLA" }, TaskFormat.Interactive],
      [
        TaskType.ColorMatch,
        {
          kind: "colorMatch",
          pairs: [
            { id: "a", word: "Azul", colorHex: "#0000FF" },
            { id: "b", word: "Vermelho", colorHex: "#FF0000" },
          ],
        },
        TaskFormat.Interactive,
      ],
      [
        TaskType.MemoryGame,
        { kind: "memoryGame", cards: [{ id: "1", label: "SOL" }, { id: "2", label: "LUA" }] },
        TaskFormat.Interactive,
      ],
      [
        TaskType.Printable,
        {
          kind: "printable",
          title: "Complete a sequência",
          instructions: "Escreva o que falta",
          layout: "SEQUENCE",
          items: [{ id: "1", text: "1, 2, __", answerLines: 1 }],
        },
        TaskFormat.Printable,
      ],
    ])("%s vira %s", (type, content, format) => {
      const task = unwrap(Task.create({ ...base, type, content }));
      expect(task.format).toBe(format);
      expect(task.content?.kind).toBe(type);
      expect(task.alternatives).toEqual([]);
    });

    it("múltipla escolha é INTERACTIVE e sem content", () => {
      const task = unwrap(
        Task.create({
          ...base,
          type: TaskType.MultipleChoice,
          alternatives: [
            { text: "A", isCorrect: true },
            { text: "B", isCorrect: false },
          ],
        })
      );
      expect(task.format).toBe(TaskFormat.Interactive);
      expect(task.content).toBeUndefined();
      expect(JSON.parse(JSON.stringify(task))).not.toHaveProperty("content");
    });
  });

  describe("content inválido (AT-02)", () => {
    it("BE-AT-01: wordBuilder sem word aponta content.word", () => {
      expect(fieldsOf(wordBuilder({ kind: "wordBuilder" }))).toEqual(["content.word"]);
    });

    it("content ausente num tipo novo aponta content", () => {
      expect(fieldsOf(wordBuilder(undefined))).toEqual(["content"]);
    });

    it("kind diferente do tipo aponta content.kind", () => {
      expect(fieldsOf(wordBuilder({ kind: "colorMatch", word: "BOLA" }))).toEqual([
        "content.kind",
      ]);
    });

    it.each(["A", "ABCDEFGHIJKLM", "BO LA", "BOLA1"])("word %s fora da regra", (word) => {
      expect(fieldsOf(wordBuilder({ kind: "wordBuilder", word }))).toEqual(["content.word"]);
    });

    it("aceita acento e normaliza para maiúsculas", () => {
      const task = unwrap(wordBuilder({ kind: "wordBuilder", word: "pão", distractors: ["x"] }));
      expect(task.content).toEqual({ kind: "wordBuilder", word: "PÃO", distractors: ["X"] });
    });

    it("mais de 6 distratores ou distrator que não é letra", () => {
      expect(
        fieldsOf(
          wordBuilder({ kind: "wordBuilder", word: "BOLA", distractors: "ABCDEFG".split("") })
        )
      ).toEqual(["content.distractors"]);
      expect(
        fieldsOf(wordBuilder({ kind: "wordBuilder", word: "BOLA", distractors: ["A", "BC"] }))
      ).toEqual(["content.distractors.1"]);
    });

    it("colorMatch: limites de pares, cor e palavra", () => {
      const create = (pairs: unknown) =>
        Task.create({
          ...base,
          type: TaskType.ColorMatch,
          content: { kind: "colorMatch", pairs },
        });

      expect(fieldsOf(create([{ id: "a", word: "Azul", colorHex: "#0000FF" }]))).toEqual([
        "content.pairs",
      ]);
      expect(
        fieldsOf(
          create([
            { id: "a", word: "Azul", colorHex: "azul" },
            { id: "a", word: "x".repeat(21), colorHex: "#FF0000" },
          ])
        )
      ).toEqual(["content.pairs.0.colorHex", "content.pairs.1.id", "content.pairs.1.word"]);
    });

    it("colorMatch normaliza a cor para maiúsculas", () => {
      const task = unwrap(
        Task.create({
          ...base,
          type: TaskType.ColorMatch,
          content: {
            kind: "colorMatch",
            pairs: [
              { id: "a", word: "Azul", colorHex: "#0000ff" },
              { id: "b", word: "Verde", colorHex: "#00ff00" },
            ],
          },
        })
      );
      expect(task.content).toMatchObject({ pairs: [{ colorHex: "#0000FF" }, { colorHex: "#00FF00" }] });
    });

    it("memoryGame: 2 a 8 cartas, cada uma com label ou imagem", () => {
      const create = (cards: unknown) =>
        Task.create({ ...base, type: TaskType.MemoryGame, content: { kind: "memoryGame", cards } });

      expect(fieldsOf(create([{ id: "1", label: "SOL" }]))).toEqual(["content.cards"]);
      expect(
        fieldsOf(create(Array.from({ length: 9 }, (_, i) => ({ id: `${i}`, label: "X" }))))
      ).toEqual(["content.cards"]);
      expect(fieldsOf(create([{ id: "1", label: "SOL" }, { id: "2" }]))).toEqual([
        "content.cards.1",
      ]);
    });

    it("printable: título, instruções, layout e itens", () => {
      const result = Task.create({
        ...base,
        type: TaskType.Printable,
        content: {
          kind: "printable",
          title: "x".repeat(81),
          instructions: "",
          layout: "TABLE",
          items: [{ id: "1", text: "ok", answerLines: 6 }, { id: "2" }],
        },
      });
      expect(fieldsOf(result)).toEqual([
        "content.title",
        "content.instructions",
        "content.layout",
        "content.items.0.answerLines",
        "content.items.1",
      ]);
    });

    it("printable precisa de 1 a 20 itens", () => {
      const create = (items: unknown[]) =>
        Task.create({
          ...base,
          type: TaskType.Printable,
          content: { kind: "printable", title: "T", instructions: "I", layout: "LIST", items },
        });
      expect(fieldsOf(create([]))).toEqual(["content.items"]);
      expect(
        fieldsOf(create(Array.from({ length: 21 }, (_, i) => ({ id: `${i}`, text: "t" }))))
      ).toEqual(["content.items"]);
    });

    it("múltipla escolha com content é INVALID_CONTENT", () => {
      const result = Task.create({
        ...base,
        type: TaskType.MultipleChoice,
        alternatives: [
          { text: "A", isCorrect: true },
          { text: "B", isCorrect: false },
        ],
        content: { kind: "wordBuilder", word: "BOLA" },
      });
      expect(fieldsOf(result)).toEqual(["content"]);
    });

    it("tipo novo com imageFile aponta imageFile", () => {
      const result = Task.create({
        ...base,
        type: TaskType.WordBuilder,
        content: { kind: "wordBuilder", word: "BOLA" },
        imageFile: "https://bucket/x.png",
      });
      expect(fieldsOf(result)).toEqual(["imageFile"]);
    });
  });

  it("AT-04: tipo novo com alternativas é ALTERNATIVES_NOT_ALLOWED", () => {
    const result = Task.create({
      ...base,
      type: TaskType.WordBuilder,
      content: { kind: "wordBuilder", word: "BOLA" },
      alternatives: [{ text: "A", isCorrect: true }],
    });
    expect(result).toEqual({ ok: false, error: "ALTERNATIVES_NOT_ALLOWED" });
  });

  describe("skills, theme e tone", () => {
    it("tone vem do cliente ou é escolhido pelo id", () => {
      const chosen = unwrap(wordBuilderWith({ tone: TaskTone.Peach }));
      expect(chosen.tone).toBe(TaskTone.Peach);

      const id = Uuid.random();
      const auto = unwrap(wordBuilderWith({ id }));
      expect(auto.tone).toBe(toneForId(id));
      expect(toneForId(id)).toBe(toneForId(new Uuid(id.value)));
    });

    it("theme até 60 e skills até 5, sem repetir", () => {
      const task = unwrap(
        wordBuilderWith({ theme: "  Animais  ", skills: ["VOCABULARIO", "VOCABULARIO"] })
      );
      expect(task.theme).toBe("Animais");
      expect(task.skills).toEqual(["VOCABULARIO"]);

      expect(wordBuilderWith({ theme: "x".repeat(61) })).toEqual({
        ok: false,
        error: "INVALID_TASK_DATA",
      });
      expect(wordBuilderWith({ skills: ["A1", "B1", "C1", "D1", "E1", "F1"] })).toEqual({
        ok: false,
        error: "INVALID_TASK_DATA",
      });
    });

    it("source padrão EDUCATOR; biblioteca não tem dono", () => {
      const educatorId = Uuid.random();
      expect(unwrap(wordBuilderWith({ educatorId })).source).toBe(TaskSource.Educator);
      const library = unwrap(wordBuilderWith({ educatorId, source: TaskSource.Library }));
      expect(library.isLibrary).toBe(true);
      expect(library.educatorId).toBeUndefined();
    });
  });

  describe("updateTask", () => {
    it("TYPE_CHANGE_NOT_ALLOWED quando o tipo muda", () => {
      const task = unwrap(wordBuilderWith({}));
      expect(task.updateTask({ type: TaskType.MemoryGame })).toEqual({
        ok: false,
        error: "TYPE_CHANGE_NOT_ALLOWED",
      });
    });

    it("revalida o content novo e mantém id, dono e criação", () => {
      const educatorId = Uuid.random();
      const task = unwrap(wordBuilderWith({ educatorId }));

      const invalid = task.updateTask({ content: { kind: "wordBuilder", word: "X" } });
      expect(fieldsOf(invalid)).toEqual(["content.word"]);

      const updated = unwrap(
        task.updateTask({ content: { kind: "wordBuilder", word: "GATO" }, theme: "Bichos" })
      );
      expect(updated.id.value).toBe(task.id.value);
      expect(updated.educatorId?.value).toBe(educatorId.value);
      expect(updated.createdAt).toBe(task.createdAt);
      expect(updated.title).toBe("GATO");
      expect(updated.theme).toBe("Bichos");
    });
  });

  it("duplicateFor cria cópia EDUCATOR do educador com id novo", () => {
    const library = unwrap(
      wordBuilderWith({ source: TaskSource.Library, skills: ["VOCABULARIO"], theme: "Casa" })
    );
    const educatorId = Uuid.random();
    const copy = library.duplicateFor(educatorId);

    expect(copy.id.value).not.toBe(library.id.value);
    expect(copy.source).toBe(TaskSource.Educator);
    expect(copy.educatorId?.value).toBe(educatorId.value);
    expect(copy.content).toEqual(library.content);
    expect(copy.content).not.toBe(library.content);
    expect(copy.skills).toEqual(["VOCABULARIO"]);
    expect(copy.theme).toBe("Casa");
    expect(copy.tone).toBe(library.tone);
  });

  it("título e miniatura por tipo", () => {
    const printable = unwrap(
      Task.create({
        ...base,
        type: TaskType.Printable,
        content: {
          kind: "printable",
          title: "Ligue os pontos",
          instructions: "Ligue",
          layout: "GRID",
          items: [{ id: "1", text: "a" }, { id: "2", imageUrl: "https://bucket/p.png" }],
        },
      })
    );
    expect(printable.title).toBe("Ligue os pontos");
    expect(printable.thumbnailUrl).toBe("https://bucket/p.png");
    expect(printable.mediaUrls).toEqual([
      { field: "content.items.1.imageUrl", url: "https://bucket/p.png" },
    ]);

    const colors = unwrap(
      Task.create({
        ...base,
        type: TaskType.ColorMatch,
        content: {
          kind: "colorMatch",
          pairs: [
            { id: "a", word: "Azul", colorHex: "#0000FF" },
            { id: "b", word: "Verde", colorHex: "#00FF00" },
          ],
        },
      })
    );
    expect(colors.title).toBe("Associe as cores");
  });
});

function wordBuilderWith(extra: Partial<Parameters<typeof Task.create>[0]>) {
  return Task.create({
    ...base,
    type: TaskType.WordBuilder,
    content: { kind: "wordBuilder", word: "BOLA" },
    ...extra,
  });
}
