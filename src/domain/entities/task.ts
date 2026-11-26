import { failure, success, Uuid } from "@wave-telecom/framework/core";
import {
  contentMediaUrls,
  readTaskContent,
  TaskContent,
  TaskContentKind,
  TaskFieldError,
} from "./task-content";

export enum TaskCategory {
  Reading = "reading",
  Writing = "writing",
  Vocabulary = "vocabulary",
  Comprehension = "comprehension",
}

export enum TaskType {
  MultipleChoice = "multipleChoice",
  MultipleChoiceWithMedia = "multipleChoiceWithMedia",
  WordBuilder = "wordBuilder",
  ColorMatch = "colorMatch",
  MemoryGame = "memoryGame",
  Printable = "printable",
}

export enum TaskFormat {
  Interactive = "INTERACTIVE",
  Printable = "PRINTABLE",
}

export enum TaskSource {
  Educator = "EDUCATOR",
  Library = "LIBRARY",
}

export enum TaskTone {
  Mint = "mint",
  Peach = "peach",
  Lavender = "lavender",
  Yellow = "yellow",
}

export const TASK_SKILLS_MAX = 5;
export const TASK_THEME_MAX = 60;

const TONES = Object.values(TaskTone);

export function isMultipleChoiceType(type: TaskType): boolean {
  return type === TaskType.MultipleChoice || type === TaskType.MultipleChoiceWithMedia;
}

// AT-03: o formato vem do tipo; o cliente não envia.
export function formatOfType(type: TaskType): TaskFormat {
  return type === TaskType.Printable ? TaskFormat.Printable : TaskFormat.Interactive;
}

// Cor da miniatura quando não vem do cliente (e nas tarefas antigas): sempre a
// mesma para o mesmo id.
export function toneForId(id: Uuid): TaskTone {
  let hash = 0;
  for (const char of id.value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

export interface TaskAlternative {
  id?: Uuid;
  text: string;
  isCorrect: boolean;
}

export type { TaskContent, TaskFieldError } from "./task-content";

export type TaskError =
  | "INVALID_TASK_DATA"
  | "ALTERNATIVES_NOT_ALLOWED"
  | "TYPE_CHANGE_NOT_ALLOWED"
  | { code: "INVALID_CONTENT"; errors: TaskFieldError[] };

export interface CreateTaskProps {
  id?: Uuid;
  createdAt?: Date;
  category: TaskCategory;
  type: TaskType;
  prompt: string;
  alternatives?: TaskAlternative[];
  imageFile?: string;
  audioFile?: string;
  source?: TaskSource;
  educatorId?: Uuid;
  skills?: string[];
  theme?: string;
  tone?: TaskTone;
  // Validado por tipo (AT-02); chega do cliente sem forma garantida.
  content?: unknown;
}

export interface UpdateTaskProps {
  category?: TaskCategory;
  type?: TaskType;
  prompt?: string;
  alternatives?: TaskAlternative[];
  imageFile?: string;
  audioFile?: string;
  skills?: string[];
  theme?: string;
  tone?: TaskTone;
  content?: unknown;
}

export interface TaskProps {
  id: Uuid;
  category: TaskCategory;
  type: TaskType;
  prompt: string;
  alternatives: TaskAlternative[];
  createdAt: Date;
  imageFile?: string;
  audioFile?: string;
  source: TaskSource;
  educatorId?: Uuid;
  skills: string[];
  theme?: string;
  tone: TaskTone;
  content?: TaskContent;
}

const COLOR_MATCH_TITLE = "Associe as cores";
const MEMORY_GAME_TITLE = "Memória visual";

export class Task {
  // Campos públicos: o JSON da entidade é a resposta `Task` da API.
  public readonly id: Uuid;
  public readonly category: TaskCategory;
  public readonly type: TaskType;
  public readonly format: TaskFormat;
  public readonly source: TaskSource;
  public readonly educatorId?: Uuid;
  public readonly prompt: string;
  public readonly alternatives: TaskAlternative[];
  public readonly skills: string[];
  public readonly theme?: string;
  public readonly tone: TaskTone;
  public readonly content?: TaskContent;
  public readonly imageFile?: string;
  public readonly audioFile?: string;
  public readonly createdAt: Date;

  private constructor(props: TaskProps) {
    this.id = props.id;
    this.category = props.category;
    this.type = props.type;
    this.format = formatOfType(props.type);
    this.source = props.source;
    this.educatorId = props.educatorId;
    this.prompt = props.prompt;
    this.alternatives = props.alternatives;
    this.skills = props.skills;
    this.theme = props.theme;
    this.tone = props.tone;
    this.content = props.content;
    this.imageFile = props.imageFile;
    this.audioFile = props.audioFile;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateTaskProps) {
    const id = props.id ?? Uuid.random();
    const alternatives = (props.alternatives ?? []).map((alt) => ({
      ...alt,
      id: alt.id ?? Uuid.random(),
    }));
    const prompt = props.prompt?.trim() ?? "";
    const theme = props.theme?.trim() || undefined;
    const skills = Array.from(new Set((props.skills ?? []).map((skill) => skill.trim())));

    if (
      !Object.values(TaskType).includes(props.type) ||
      !Object.values(TaskCategory).includes(props.category) ||
      prompt.length === 0 ||
      skills.length > TASK_SKILLS_MAX ||
      skills.some((skill) => skill.length === 0) ||
      (theme !== undefined && theme.length > TASK_THEME_MAX) ||
      (props.tone !== undefined && !TONES.includes(props.tone))
    ) {
      return failure<TaskError>("INVALID_TASK_DATA");
    }

    let content: TaskContent | undefined;

    if (isMultipleChoiceType(props.type)) {
      if (props.content !== undefined && props.content !== null) {
        return failure<TaskError>({
          code: "INVALID_CONTENT",
          errors: [{ field: "content", message: "Múltipla escolha não usa content" }],
        });
      }
      if (!validMultipleChoice(props.type, alternatives, props.imageFile, props.audioFile)) {
        return failure<TaskError>("INVALID_TASK_DATA");
      }
    } else {
      // AT-04: só múltipla escolha tem alternativas.
      if (alternatives.length > 0) return failure<TaskError>("ALTERNATIVES_NOT_ALLOWED");

      const read = readTaskContent(props.type as TaskContentKind, props.content);
      const errors = [...read.errors];
      // Nos tipos novos a mídia fica dentro de content.
      if (props.imageFile) errors.push({ field: "imageFile", message: "Use as mídias de content" });
      if (props.audioFile) errors.push({ field: "audioFile", message: "Use as mídias de content" });
      if (errors.length > 0) return failure<TaskError>({ code: "INVALID_CONTENT", errors });
      content = read.content;
    }

    return success(
      new Task({
        id,
        category: props.category,
        type: props.type,
        prompt,
        alternatives,
        createdAt: props.createdAt ?? new Date(),
        imageFile: props.imageFile,
        audioFile: props.audioFile,
        source: props.source ?? TaskSource.Educator,
        educatorId: props.source === TaskSource.Library ? undefined : props.educatorId,
        skills,
        theme,
        tone: props.tone ?? toneForId(id),
        content,
      })
    );
  }

  // Leitura do banco: sem revalidar (tarefas antigas já vêm com os defaults).
  static fromPersistence(props: TaskProps): Task {
    return new Task(props);
  }

  // Atualização revalida tudo; o tipo não muda.
  public updateTask(props: UpdateTaskProps) {
    if (props.type !== undefined && props.type !== this.type) {
      return failure<TaskError>("TYPE_CHANGE_NOT_ALLOWED");
    }

    return Task.create({
      id: this.id,
      createdAt: this.createdAt,
      source: this.source,
      educatorId: this.educatorId,
      type: this.type,
      category: props.category ?? this.category,
      prompt: props.prompt ?? this.prompt,
      alternatives: props.alternatives ?? this.alternatives,
      imageFile: props.imageFile ?? this.imageFile,
      audioFile: props.audioFile ?? this.audioFile,
      skills: props.skills ?? this.skills,
      theme: props.theme ?? this.theme,
      tone: props.tone ?? this.tone,
      content: props.content ?? this.content,
    });
  }

  // AT-07: cópia editável do educador, com ids novos.
  public duplicateFor(educatorId: Uuid): Task {
    const id = Uuid.random();
    return new Task({
      id,
      category: this.category,
      type: this.type,
      prompt: this.prompt,
      alternatives: this.alternatives.map((alt) => ({
        text: alt.text,
        isCorrect: alt.isCorrect,
        id: Uuid.random(),
      })),
      createdAt: new Date(),
      imageFile: this.imageFile,
      audioFile: this.audioFile,
      source: TaskSource.Educator,
      educatorId,
      skills: [...this.skills],
      theme: this.theme,
      tone: this.tone,
      content: this.content ? structuredClone(this.content) : undefined,
    });
  }

  get isLibrary(): boolean {
    return this.source === TaskSource.Library;
  }

  get isPrintable(): boolean {
    return this.type === TaskType.Printable;
  }

  // Dono explícito diferente do educador. Tarefas antigas não têm dono gravado.
  public belongsToAnotherEducator(educatorId: Uuid): boolean {
    return !!this.educatorId && this.educatorId.value !== educatorId.value;
  }

  // Título de exibição (TaskSummary).
  get title(): string {
    switch (this.content?.kind) {
      case "wordBuilder":
        return this.content.word;
      case "colorMatch":
        return COLOR_MATCH_TITLE;
      case "memoryGame":
        return MEMORY_GAME_TITLE;
      case "printable":
        return this.content.title;
      default:
        return this.prompt;
    }
  }

  get thumbnailUrl(): string | undefined {
    switch (this.content?.kind) {
      case "wordBuilder":
        return this.content.hintImageUrl;
      case "memoryGame":
        return this.content.cards.find((card) => card.imageUrl)?.imageUrl;
      case "printable":
        return this.content.items.find((item) => item.imageUrl)?.imageUrl;
      case "colorMatch":
        return undefined;
      default:
        return this.imageFile;
    }
  }

  get mediaUrls() {
    return contentMediaUrls(this.content);
  }

  public getCorrectAnswer() {
    const correct = this.alternatives.find((alt) => alt.isCorrect);
    return success(correct!);
  }
}

function validMultipleChoice(
  type: TaskType,
  alternatives: TaskAlternative[],
  imageFile?: string,
  audioFile?: string
): boolean {
  if (alternatives.length < 2) return false;
  if (alternatives.filter((alt) => alt.isCorrect).length !== 1) return false;
  if (type === TaskType.MultipleChoiceWithMedia && !imageFile && !audioFile) return false;
  if (type === TaskType.MultipleChoice && (imageFile || audioFile)) return false;
  return true;
}
