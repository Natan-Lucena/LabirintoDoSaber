import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import {
  AiStudentAnalysisService,
  StudentAnalysisAiInput,
  StudentAnalysisAnamneseAnswer,
} from "../../../../../domain/services/ai-student-analysis-service";
import { AnamneseAnswer } from "../../../../../domain/entities/anamnese-response";
import { AnamneseTemplate } from "../../../../../domain/entities/anamnese-template";
import { GenerateStudentAnalysisUseCase } from "../generate-student-analisys/generate-student-analisys-use-case";

export interface GenerateStudentAiAnalysisUseCaseRequest {
  studentId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  templateId?: string;
}

export class GenerateStudentAiAnalysisUseCase {
  constructor(
    private generateStudentAnalysisUseCase: GenerateStudentAnalysisUseCase,
    private anamneseTemplateRepository: AnamneseTemplateRepository,
    private anamneseResponseRepository: AnamneseResponseRepository,
    private aiStudentAnalysisService: AiStudentAnalysisService
  ) {}

  async execute(request: GenerateStudentAiAnalysisUseCaseRequest) {
    // loadAnalysisData já faz, numa única leva, a busca de student +
    // sessões + tasks em lote (também valida o aluno). buildAnamnese não
    // depende de nada disso, então roda em paralelo em vez de esperar.
    const [rawResult, anamnese] = await Promise.all([
      this.generateStudentAnalysisUseCase.loadAnalysisData({
        studentId: request.studentId,
        startDate: request.startDate,
        endDate: request.endDate,
        limit: request.limit,
      }),
      request.templateId
        ? this.buildAnamnese(request.templateId, request.studentId)
        : Promise.resolve(null),
    ]);

    if (!rawResult.ok) {
      return failure(rawResult.error);
    }

    const { student, sessions, taskById, categories, total } = rawResult.value;

    const sessionSummaries: StudentAnalysisAiInput["sessions"] = sessions.map(
      (session) => {
        let correctAnswers = 0;
        let totalTime = 0;

        const answers = session.answers.map((answer) => {
          const task = taskById.get(answer.taskId.value);
          if (answer.isCorrect) correctAnswers++;
          totalTime += answer.timeToAnswer;

          return {
            taskPrompt: task?.prompt,
            category: task?.category,
            isCorrect: answer.isCorrect,
            timeToAnswer: answer.timeToAnswer,
          };
        });

        return {
          name: session.name,
          startedAt: session.startedAt.toISOString(),
          finishedAt: session.finishedAt?.toISOString(),
          observation: session.observation,
          totalAnswers: session.answers.length,
          correctAnswers,
          averageTimeToAnswer: session.answers.length
            ? totalTime / session.answers.length
            : undefined,
          answers,
        };
      },
    );

    const input: StudentAnalysisAiInput = {
      student: {
        name: student.name,
        age: student.age,
        gender: student.gender,
        learningTopics: student.learningTopics,
      },
      period: {
        startDate: request.startDate?.toISOString(),
        endDate: request.endDate?.toISOString(),
        limit: request.limit,
      },
      metrics: {
        total,
        categories: Object.values(categories),
      },
      sessions: sessionSummaries,
    };

    if (anamnese) {
      input.anamnese = anamnese;
    }

    let analysis: string;
    try {
      analysis = await this.aiStudentAnalysisService.generate(input);
    } catch (err) {
      console.error("[generate-student-ai-analysis] Gemini call failed", err);
      return failure("AI_ANALYSIS_FAILED");
    }

    return success({ analysis });
  }

  private async buildAnamnese(
    templateId: string,
    studentId: string
  ): Promise<StudentAnalysisAiInput["anamnese"] | null> {
    const template = await this.anamneseTemplateRepository.findById(
      new Uuid(templateId)
    );

    if (!template) return null;

    const responses = await this.anamneseResponseRepository.listByStudentId(
      new Uuid(studentId)
    );

    const templateResponses = responses.filter(
      (response) => response.templateId.value === templateId
    );

    if (!templateResponses.length) return null;

    const answers: StudentAnalysisAnamneseAnswer[] = [];
    for (const response of templateResponses) {
      for (const answer of response.answers) {
        answers.push({
          question: this.resolveQuestionText(template, answer.questionId),
          answer: this.resolveAnswerText(template, answer),
        });
      }
    }

    return { templateTitle: template.title, answers };
  }

  private resolveQuestionText(
    template: AnamneseTemplate,
    questionId: string
  ): string {
    const question = template.questions.find((q) => q.id === questionId);
    return question?.text ?? "(pergunta não encontrada)";
  }

  private resolveAnswerText(
    template: AnamneseTemplate,
    answer: AnamneseAnswer
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
        .map(
          (id) =>
            question?.options.find((o) => o.id === id)?.text ?? id
        )
        .join(", ");
    }

    if (answer.fileUrl) return `Arquivo enviado: ${answer.fileUrl}`;

    return "(sem resposta)";
  }
}
