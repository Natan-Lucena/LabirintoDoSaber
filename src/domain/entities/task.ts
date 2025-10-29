import { failure, success, Uuid } from "@wave-telecom/framework/core";

export enum TaskCategory {
  Reading,
  Writing,
  Vocabulary,
  Comprehension,
}

export enum TaskType {
  MultipleChoice,
  MultipleChoiceWithMedia,
}

export interface TaskAlternative {
  id?: Uuid;
  text: string;
  isCorrect: boolean;
}

export interface CreateTaskProps {
  id?: Uuid;
  createdAt?: Date;
  category: TaskCategory;
  type: TaskType;
  prompt: string;
  alternatives: TaskAlternative[];
  imageFile?: string;
  audioFile?: string;
}

export class Task {
  private constructor(
    public readonly id: Uuid,
    public readonly category: TaskCategory,
    public readonly type: TaskType,
    public readonly prompt: string,
    public readonly alternatives: TaskAlternative[],
    public readonly createdAt: Date,
    public readonly imageFile?: string,
    public readonly audioFile?: string
  ) {
    this.validateTaskStructure();
  }

  static create(props: CreateTaskProps) {
    const alternativesWithIds = props.alternatives.map((alt) => ({
      ...alt,
      id: alt.id || Uuid.random(),
    })) as TaskAlternative[];
    try {
      return success(
        new Task(
          props.id || Uuid.random(),
          props.category,
          props.type,
          props.prompt,
          alternativesWithIds,
          props.createdAt || new Date(),
          props.imageFile,
          props.audioFile
        )
      );
    } catch (error) {
      return failure(void 0);
    }
  }

  private validateTaskStructure(): void {
    if (this.alternatives.length < 2) {
      throw new Error("Uma atividade deve ter pelo menos duas alternativas.");
    }

    const correctAlternatives = this.alternatives.filter(
      (alt) => alt.isCorrect
    );
    if (correctAlternatives.length !== 1) {
      throw new Error(
        "Uma atividade deve ter exatamente uma alternativa correta."
      );
    }

    if (this.type === TaskType.MultipleChoiceWithMedia) {
      if (!this.imageFile && !this.audioFile) {
        throw new Error(
          "Atividades do tipo 'Múltipla Escolha com Mídia' requerem um arquivo de imagem ou áudio."
        );
      }
    }

    if (this.type === TaskType.MultipleChoice) {
      if (this.imageFile || this.audioFile) {
        throw new Error(
          "Atividades do tipo 'Múltipla Escolha' não podem conter arquivos de mídia."
        );
      }
    }
  }

  public getCorrectAnswer() {
    const correct = this.alternatives.find((alt) => alt.isCorrect);
    return success(correct!);
  }
}
