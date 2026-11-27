import { normalizeText } from "../utils/text";

// Conteúdo dos tipos de atividade novos (jogos e imprimível). A validação
// devolve o conteúdo normalizado e os erros com o campo no formato
// `content.word`, `content.pairs.0.colorHex`.

export interface WordBuilderContent {
  kind: "wordBuilder";
  word: string;
  distractors?: string[];
  hintImageUrl?: string;
  hintAudioUrl?: string;
}

export interface ColorMatchPair {
  id: string;
  word: string;
  colorHex: string;
}

export interface ColorMatchContent {
  kind: "colorMatch";
  pairs: ColorMatchPair[];
}

export interface MemoryGameCard {
  id: string;
  label?: string;
  imageUrl?: string;
}

export interface MemoryGameContent {
  kind: "memoryGame";
  cards: MemoryGameCard[];
}

export type PrintableLayout = "LIST" | "GRID" | "SEQUENCE";
export const PRINTABLE_LAYOUTS: PrintableLayout[] = ["LIST", "GRID", "SEQUENCE"];

export interface PrintableItem {
  id: string;
  text?: string;
  imageUrl?: string;
  answerLines?: number;
}

export interface PrintableContent {
  kind: "printable";
  title: string;
  instructions: string;
  layout: PrintableLayout;
  items: PrintableItem[];
}

export type TaskContent =
  | WordBuilderContent
  | ColorMatchContent
  | MemoryGameContent
  | PrintableContent;

export type TaskContentKind = TaskContent["kind"];

export interface TaskFieldError {
  field: string;
  message: string;
}

export interface MediaUrlRef {
  field: string;
  url: string;
}

export const CONTENT_LIMITS = {
  wordMin: 2,
  wordMax: 12,
  distractorsMax: 6,
  pairsMin: 2,
  pairsMax: 6,
  pairWordMax: 20,
  cardsMin: 2,
  cardsMax: 8,
  cardLabelMax: 40,
  titleMax: 80,
  instructionsMax: 500,
  itemsMin: 1,
  itemsMax: 20,
  itemTextMax: 200,
  answerLinesMax: 5,
  idMax: 64,
  urlMax: 2048,
};

type Source = Record<string, unknown>;

const isObject = (value: unknown): value is Source =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Junta os erros enquanto lê cada campo; o que falha volta como undefined.
class ContentReader {
  readonly errors: TaskFieldError[] = [];

  error(field: string, message: string) {
    this.errors.push({ field, message });
  }

  text(source: Source, key: string, path: string, max: number, optional = false) {
    const field = `${path}.${key}`;
    const value = source[key];
    if (value === undefined || value === null) {
      if (!optional) this.error(field, "Obrigatório");
      return undefined;
    }
    if (typeof value !== "string") {
      this.error(field, "Deve ser texto");
      return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > max) {
      this.error(field, `Deve ter de 1 a ${max} caracteres`);
      return undefined;
    }
    return trimmed;
  }

  url(source: Source, key: string, path: string) {
    return this.text(source, key, path, CONTENT_LIMITS.urlMax, true);
  }

  list(source: Source, key: string, path: string, min: number, max: number, optional = false) {
    const field = `${path}.${key}`;
    const value = source[key];
    if (value === undefined || value === null) {
      if (!optional) this.error(field, "Obrigatório");
      return undefined;
    }
    if (!Array.isArray(value)) {
      this.error(field, "Deve ser uma lista");
      return undefined;
    }
    if (value.length < min || value.length > max) {
      this.error(field, `Deve ter de ${min} a ${max} itens`);
      return undefined;
    }
    return value as unknown[];
  }

  // Lê cada elemento como objeto com id único na lista, um por vez, para os
  // erros saírem na ordem dos itens.
  *entries(values: unknown[], path: string) {
    const seen = new Set<string>();
    for (const [index, value] of values.entries()) {
      const entryPath = `${path}.${index}`;
      if (!isObject(value)) {
        this.error(entryPath, "Deve ser um objeto");
        continue;
      }
      const id = this.text(value, "id", entryPath, CONTENT_LIMITS.idMax);
      if (id !== undefined) {
        if (seen.has(id)) this.error(`${entryPath}.id`, "Id repetido");
        seen.add(id);
      }
      yield { source: value, path: entryPath, id };
    }
  }
}

const UPPERCASE_WORD = /^\p{Lu}+$/u;
const UPPERCASE_LETTER = /^\p{Lu}$/u;
const COLOR_HEX = /^#[0-9A-F]{6}$/;

function readWordBuilder(reader: ContentReader, source: Source): WordBuilderContent | undefined {
  const path = "content";
  const rawWord = reader.text(source, "word", path, 100);
  let word: string | undefined;
  if (rawWord !== undefined) {
    const upper = rawWord.toLocaleUpperCase("pt-BR");
    const length = [...upper].length;
    if (
      !UPPERCASE_WORD.test(upper) ||
      length < CONTENT_LIMITS.wordMin ||
      length > CONTENT_LIMITS.wordMax
    ) {
      reader.error(
        "content.word",
        `Deve ter de ${CONTENT_LIMITS.wordMin} a ${CONTENT_LIMITS.wordMax} letras, sem espaços`
      );
    } else {
      word = upper;
    }
  }

  const rawDistractors = reader.list(
    source,
    "distractors",
    path,
    0,
    CONTENT_LIMITS.distractorsMax,
    true
  );
  const distractors: string[] = [];
  rawDistractors?.forEach((value, index) => {
    const upper = typeof value === "string" ? value.trim().toLocaleUpperCase("pt-BR") : "";
    if (!UPPERCASE_LETTER.test(upper)) {
      reader.error(`content.distractors.${index}`, "Deve ser uma letra");
      return;
    }
    distractors.push(upper);
  });

  const hintImageUrl = reader.url(source, "hintImageUrl", path);
  const hintAudioUrl = reader.url(source, "hintAudioUrl", path);

  if (word === undefined) return undefined;
  return {
    kind: "wordBuilder",
    word,
    ...(rawDistractors ? { distractors } : {}),
    ...(hintImageUrl ? { hintImageUrl } : {}),
    ...(hintAudioUrl ? { hintAudioUrl } : {}),
  };
}

function readColorMatch(reader: ContentReader, source: Source): ColorMatchContent | undefined {
  const values = reader.list(
    source,
    "pairs",
    "content",
    CONTENT_LIMITS.pairsMin,
    CONTENT_LIMITS.pairsMax
  );
  if (!values) return undefined;

  const pairs: ColorMatchPair[] = [];
  const colors = new Set<string>();
  for (const entry of reader.entries(values, "content.pairs")) {
    const word = reader.text(entry.source, "word", entry.path, CONTENT_LIMITS.pairWordMax);
    const rawHex = reader.text(entry.source, "colorHex", entry.path, 7);
    const colorHex = rawHex?.toUpperCase();
    if (rawHex !== undefined && !COLOR_HEX.test(colorHex!)) {
      reader.error(`${entry.path}.colorHex`, "Deve estar no formato #RRGGBB");
      continue;
    }
    // Duas palavras com a mesma cor tornam o jogo ambíguo.
    if (colorHex !== undefined) {
      if (colors.has(colorHex)) {
        reader.error(`${entry.path}.colorHex`, "Cor repetida");
        continue;
      }
      colors.add(colorHex);
    }
    if (entry.id && word && colorHex) pairs.push({ id: entry.id, word, colorHex });
  }
  return { kind: "colorMatch", pairs };
}

function readMemoryGame(reader: ContentReader, source: Source): MemoryGameContent | undefined {
  const values = reader.list(
    source,
    "cards",
    "content",
    CONTENT_LIMITS.cardsMin,
    CONTENT_LIMITS.cardsMax
  );
  if (!values) return undefined;

  const cards: MemoryGameCard[] = [];
  const faces = new Set<string>();
  for (const entry of reader.entries(values, "content.cards")) {
    const label = reader.text(entry.source, "label", entry.path, CONTENT_LIMITS.cardLabelMax, true);
    const imageUrl = reader.url(entry.source, "imageUrl", entry.path);
    if (entry.source.label == null && entry.source.imageUrl == null) {
      reader.error(entry.path, "Informe label ou imageUrl");
      continue;
    }
    // Cartas iguais formariam pares trocados.
    const face = `${normalizeText(label ?? "")}|${imageUrl ?? ""}`;
    if (faces.has(face)) {
      reader.error(entry.path, "Carta repetida");
      continue;
    }
    faces.add(face);
    if (entry.id) {
      cards.push({
        id: entry.id,
        ...(label ? { label } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      });
    }
  }
  return { kind: "memoryGame", cards };
}

function readPrintable(reader: ContentReader, source: Source): PrintableContent | undefined {
  const title = reader.text(source, "title", "content", CONTENT_LIMITS.titleMax);
  const instructions = reader.text(
    source,
    "instructions",
    "content",
    CONTENT_LIMITS.instructionsMax
  );

  const layout = source.layout as PrintableLayout;
  if (!PRINTABLE_LAYOUTS.includes(layout)) {
    reader.error("content.layout", `Valores válidos: ${PRINTABLE_LAYOUTS.join(", ")}`);
  }

  const values = reader.list(
    source,
    "items",
    "content",
    CONTENT_LIMITS.itemsMin,
    CONTENT_LIMITS.itemsMax
  );
  const items: PrintableItem[] = [];
  for (const entry of values ? reader.entries(values, "content.items") : []) {
    const text = reader.text(entry.source, "text", entry.path, CONTENT_LIMITS.itemTextMax, true);
    const imageUrl = reader.url(entry.source, "imageUrl", entry.path);
    if (entry.source.text == null && entry.source.imageUrl == null) {
      reader.error(entry.path, "Informe text ou imageUrl");
      continue;
    }

    const answerLines = entry.source.answerLines;
    const validLines =
      answerLines === undefined ||
      answerLines === null ||
      (Number.isInteger(answerLines) &&
        (answerLines as number) >= 0 &&
        (answerLines as number) <= CONTENT_LIMITS.answerLinesMax);
    if (!validLines) {
      reader.error(
        `${entry.path}.answerLines`,
        `Deve ser inteiro de 0 a ${CONTENT_LIMITS.answerLinesMax}`
      );
      continue;
    }

    if (entry.id) {
      items.push({
        id: entry.id,
        ...(text ? { text } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(typeof answerLines === "number" ? { answerLines } : {}),
      });
    }
  }

  if (!title || !instructions || !PRINTABLE_LAYOUTS.includes(layout) || !values) {
    return undefined;
  }
  return { kind: "printable", title, instructions, layout, items };
}

const READERS: Record<
  TaskContentKind,
  (reader: ContentReader, source: Source) => TaskContent | undefined
> = {
  wordBuilder: readWordBuilder,
  colorMatch: readColorMatch,
  memoryGame: readMemoryGame,
  printable: readPrintable,
};

export function isContentKind(value: string): value is TaskContentKind {
  return value in READERS;
}

// Valida o conteúdo de um tipo novo. `kind` precisa ser igual ao tipo.
export function readTaskContent(
  kind: TaskContentKind,
  value: unknown
): { content?: TaskContent; errors: TaskFieldError[] } {
  const reader = new ContentReader();

  if (value === undefined || value === null) {
    reader.error("content", "Obrigatório para este tipo");
    return { errors: reader.errors };
  }
  if (!isObject(value)) {
    reader.error("content", "Deve ser um objeto");
    return { errors: reader.errors };
  }
  if (value.kind !== kind) {
    reader.error("content.kind", `Deve ser "${kind}"`);
  }

  const content = READERS[kind](reader, value);
  if (reader.errors.length > 0) return { errors: reader.errors };
  return { content, errors: [] };
}

// URLs de mídia do conteúdo, com o campo de cada uma (AT-05).
export function contentMediaUrls(content?: TaskContent): MediaUrlRef[] {
  if (!content) return [];
  switch (content.kind) {
    case "wordBuilder":
      return [
        ...(content.hintImageUrl
          ? [{ field: "content.hintImageUrl", url: content.hintImageUrl }]
          : []),
        ...(content.hintAudioUrl
          ? [{ field: "content.hintAudioUrl", url: content.hintAudioUrl }]
          : []),
      ];
    case "colorMatch":
      return [];
    case "memoryGame":
      return content.cards.flatMap((card, index) =>
        card.imageUrl ? [{ field: `content.cards.${index}.imageUrl`, url: card.imageUrl }] : []
      );
    case "printable":
      return content.items.flatMap((item, index) =>
        item.imageUrl ? [{ field: `content.items.${index}.imageUrl`, url: item.imageUrl }] : []
      );
  }
}
