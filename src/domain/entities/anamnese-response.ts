import { failure, success, Uuid } from "@wave-telecom/framework/core";
import {
  AnamneseQuestion,
  AnamneseQuestionType,
  AnamneseTemplate,
} from "./anamnese-template";

export interface AnamneseAnswer {
  questionId: string;
  questionType: AnamneseQuestionType;
  textValue?: string;
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  fileUrl?: string;
}

export interface AnamneseAnswerInput {
  questionId: string;
  textValue?: string;
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  fileUrl?: string;
}

export interface CreateAnamneseResponseProps {
  id?: Uuid;
  templateId: Uuid;
  educatorId: Uuid;
  studentId: Uuid;
  answers: AnamneseAnswerInput[];
  answeredAt?: Date;
}

export class AnamneseResponse {
  private constructor(
    public readonly id: Uuid,
    public readonly templateId: Uuid,
    public readonly educatorId: Uuid,
    public readonly studentId: Uuid,
    public readonly answers: AnamneseAnswer[],
    public readonly answeredAt: Date,
    public readonly updatedAt?: Date
  ) {}

  static create(props: CreateAnamneseResponseProps, template: AnamneseTemplate) {
    const builtAnswers = AnamneseResponse.buildAnswers(props.answers, template);
    if (!builtAnswers.ok) {
      return builtAnswers;
    }

    return success(
      new AnamneseResponse(
        props.id ?? Uuid.random(),
        props.templateId,
        props.educatorId,
        props.studentId,
        builtAnswers.value,
        props.answeredAt ?? new Date()
      )
    );
  }

  updateAnswers(inputs: AnamneseAnswerInput[], template: AnamneseTemplate) {
    const builtAnswers = AnamneseResponse.buildAnswers(inputs, template);
    if (!builtAnswers.ok) {
      return builtAnswers;
    }

    return success(
      new AnamneseResponse(
        this.id,
        this.templateId,
        this.educatorId,
        this.studentId,
        builtAnswers.value,
        this.answeredAt,
        new Date()
      )
    );
  }

  static fromPersistence(props: {
    id: Uuid;
    templateId: Uuid;
    educatorId: Uuid;
    studentId: Uuid;
    answers: AnamneseAnswer[];
    answeredAt: Date;
    updatedAt?: Date;
  }) {
    return new AnamneseResponse(
      props.id,
      props.templateId,
      props.educatorId,
      props.studentId,
      props.answers,
      props.answeredAt,
      props.updatedAt
    );
  }

  private static buildAnswers(
    inputs: AnamneseAnswerInput[],
    template: AnamneseTemplate
  ) {
    const answersById = new Map(inputs.map((a) => [a.questionId, a]));

    for (const question of template.questions) {
      const input = answersById.get(question.id);
      if (question.required && !input) {
        return failure("MISSING_REQUIRED_ANSWER");
      }
    }

    const questionMap = new Map(template.questions.map((q) => [q.id, q]));
    const builtAnswers: AnamneseAnswer[] = [];

    for (const input of inputs) {
      const question = questionMap.get(input.questionId);
      if (!question) {
        return failure("INVALID_QUESTION_ID");
      }

      const answer = AnamneseResponse.buildAnswer(input, question);
      if (!answer.ok) {
        return answer;
      }
      builtAnswers.push(answer.value);
    }

    return success(builtAnswers);
  }

  private static buildAnswer(input: AnamneseAnswerInput, question: AnamneseQuestion) {
    const base = { questionId: input.questionId, questionType: question.type };

    switch (question.type) {
      case AnamneseQuestionType.Descriptive: {
        if (!input.textValue) return failure("MISSING_TEXT_VALUE");
        return success({ ...base, textValue: input.textValue });
      }

      case AnamneseQuestionType.MultipleChoice: {
        if (!input.selectedOptionId) return failure("MISSING_SELECTED_OPTION");
        const valid = question.options.some((o) => o.id === input.selectedOptionId);
        if (!valid) return failure("INVALID_OPTION_ID");
        return success({ ...base, selectedOptionId: input.selectedOptionId });
      }

      case AnamneseQuestionType.Checkbox: {
        if (!input.selectedOptionIds?.length) return failure("MISSING_SELECTED_OPTIONS");
        const allValid = input.selectedOptionIds.every((id) =>
          question.options.some((o) => o.id === id)
        );
        if (!allValid) return failure("INVALID_OPTION_ID");
        return success({ ...base, selectedOptionIds: input.selectedOptionIds });
      }

      case AnamneseQuestionType.FileUpload: {
        if (!input.fileUrl) return failure("MISSING_FILE_URL");
        return success({ ...base, fileUrl: input.fileUrl });
      }
    }
  }
}
