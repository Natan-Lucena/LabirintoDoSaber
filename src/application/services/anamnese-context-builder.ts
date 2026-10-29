import { Uuid } from "@wave-telecom/framework/core";
import { AnamneseAnswer } from "../../domain/entities/anamnese-response";
import { AnamneseTemplate } from "../../domain/entities/anamnese-template";
import { AnamneseResponseRepository } from "../../domain/repositories/anamnese-response-repository";
import { AnamneseTemplateRepository } from "../../domain/repositories/anamnese-template-repository";

export interface AnamneseContextAnswer {
  question: string;
  answer: string;
}

export interface AnamneseContext {
  templateTitle?: string;
  answers: AnamneseContextAnswer[];
}

export interface BuildAnamneseOptions {
  // Troca a URL de arquivos enviados por um marcador. Usado quando o contexto
  // vai para a IA e não pode carregar documentos do paciente.
  omitFileUrls?: boolean;
}

// Converte as respostas de anamnese de um aluno, num template, em pares
// pergunta/resposta legíveis para os prompts de IA.
export class AnamneseContextBuilder {
  constructor(
    private anamneseTemplateRepository: AnamneseTemplateRepository,
    private anamneseResponseRepository: AnamneseResponseRepository
  ) {}

  async buildAnamnese(
    templateId: string,
    studentId: string,
    options: BuildAnamneseOptions = {}
  ): Promise<AnamneseContext | null> {
    const template = await this.anamneseTemplateRepository.findById(
      new Uuid(templateId)
    );

    if (!template) return null;

    return this.buildAnswers(template, templateId, studentId, options);
  }

  // Para quem já carregou o template (ex.: para checar o dono).
  async buildFromTemplate(
    template: AnamneseTemplate,
    studentId: string,
    options: BuildAnamneseOptions = {}
  ): Promise<AnamneseContext | null> {
    return this.buildAnswers(template, template.id.value, studentId, options);
  }

  private async buildAnswers(
    template: AnamneseTemplate,
    templateId: string,
    studentId: string,
    options: BuildAnamneseOptions
  ): Promise<AnamneseContext | null> {
    const responses = await this.anamneseResponseRepository.listByStudentId(
      new Uuid(studentId)
    );

    const templateResponses = responses.filter(
      (response) => response.templateId.value === templateId
    );

    if (!templateResponses.length) return null;

    const answers: AnamneseContextAnswer[] = [];
    for (const response of templateResponses) {
      for (const answer of response.answers) {
        answers.push({
          question: resolveQuestionText(template, answer.questionId),
          answer: resolveAnswerText(template, answer, options),
        });
      }
    }

    return { templateTitle: template.title, answers };
  }
}

export function resolveQuestionText(
  template: AnamneseTemplate,
  questionId: string
): string {
  const question = template.questions.find((q) => q.id === questionId);
  return question?.text ?? "(pergunta não encontrada)";
}

export function resolveAnswerText(
  template: AnamneseTemplate,
  answer: AnamneseAnswer,
  options: BuildAnamneseOptions = {}
): string {
  const question = template.questions.find((q) => q.id === answer.questionId);

  if (answer.textValue) return answer.textValue;

  if (answer.selectedOptionId) {
    const option = question?.options.find(
      (o) => o.id === answer.selectedOptionId
    );
    return option?.text ?? answer.selectedOptionId;
  }

  if (answer.selectedOptionIds?.length) {
    return answer.selectedOptionIds
      .map((id) => question?.options.find((o) => o.id === id)?.text ?? id)
      .join(", ");
  }

  if (answer.fileUrl) {
    return options.omitFileUrls
      ? "(arquivo enviado)"
      : `Arquivo enviado: ${answer.fileUrl}`;
  }

  return "(sem resposta)";
}
