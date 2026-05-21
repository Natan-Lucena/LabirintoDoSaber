import { failure, success, Uuid } from "@wave-telecom/framework/core";

export enum AnamneseQuestionType {
  Descriptive = "Descriptive",
  MultipleChoice = "MultipleChoice",
  Checkbox = "Checkbox",
  FileUpload = "FileUpload",
}

export interface AnamneseQuestionOption {
  id: string;
  text: string;
}

export interface AnamneseQuestion {
  id: string;
  text: string;
  type: AnamneseQuestionType;
  required: boolean;
  order: number;
  options: AnamneseQuestionOption[];
}

export interface AnamneseQuestionInput {
  text: string;
  type: AnamneseQuestionType;
  required: boolean;
  options?: { text: string }[];
}

export interface CreateAnamneseTemplateProps {
  id?: Uuid;
  educatorId: Uuid;
  title: string;
  description?: string;
  questions: AnamneseQuestionInput[];
  createdAt?: Date;
}

export interface UpdateAnamneseTemplateProps {
  title?: string;
  description?: string;
  questions?: AnamneseQuestionInput[];
}

export class AnamneseTemplate {
  private constructor(
    public readonly id: Uuid,
    public readonly educatorId: Uuid,
    public readonly title: string,
    public readonly description: string | undefined,
    public readonly questions: AnamneseQuestion[],
    public readonly createdAt: Date
  ) {}

  static create(props: CreateAnamneseTemplateProps) {
    try {
      const questions = props.questions.map((q, index) => ({
        ...q,
        id: Uuid.random().value,
        order: index,
        options: (q.options ?? []).map((o) => ({
          ...o,
          id: Uuid.random().value,
        })),
      }));

      return success(
        new AnamneseTemplate(
          props.id ?? Uuid.random(),
          props.educatorId,
          props.title,
          props.description,
          questions,
          props.createdAt ?? new Date()
        )
      );
    } catch {
      return failure(void 0);
    }
  }

  static fromPersistence(props: {
    id: Uuid;
    educatorId: Uuid;
    title: string;
    description?: string;
    questions: AnamneseQuestion[];
    createdAt: Date;
  }) {
    return new AnamneseTemplate(
      props.id,
      props.educatorId,
      props.title,
      props.description,
      props.questions,
      props.createdAt
    );
  }

  update(props: UpdateAnamneseTemplateProps) {
    try {
      const questions = props.questions
        ? props.questions.map((q, index) => ({
            ...q,
            id: Uuid.random().value,
            order: index,
            options: (q.options ?? []).map((o) => ({
              ...o,
              id: Uuid.random().value,
            })),
          }))
        : this.questions;

      return success(
        new AnamneseTemplate(
          this.id,
          this.educatorId,
          props.title ?? this.title,
          props.description !== undefined ? props.description : this.description,
          questions,
          this.createdAt
        )
      );
    } catch {
      return failure("INVALID_TEMPLATE_DATA");
    }
  }
}
