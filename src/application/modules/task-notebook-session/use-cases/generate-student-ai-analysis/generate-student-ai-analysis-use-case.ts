import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import {
  AiStudentAnalysisService,
  StudentAnalysisAiInput,
  StudentAnalysisAnamneseAnswer,
} from "../../../../../domain/services/ai-student-analysis-service";
import { Task } from "../../../../../domain/entities/task";
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
    private studentRepository: StudentRepository,
    private taskRepository: TaskRepository,
    private anamneseTemplateRepository: AnamneseTemplateRepository,
    private anamneseResponseRepository: AnamneseResponseRepository,
    private aiStudentAnalysisService: AiStudentAnalysisService
  ) {}

  async execute(request: GenerateStudentAiAnalysisUseCaseRequest) {
    // Reaproveita o cálculo de métricas/sessões (também valida o aluno).
    const analysisResult = await this.generateStudentAnalysisUseCase.execute({
      studentId: request.studentId,
      startDate: request.startDate,
      endDate: request.endDate,
      limit: request.limit,
    });

    if (!analysisResult.ok) {
      return failure(analysisResult.error);
    }

    const student = await this.studentRepository.getById(
      new Uuid(request.studentId)
    );

    if (!student) {
      return failure("STUDENT_NOT_FOUND");
    }

    const { categories, total, sessions } = analysisResult.value;

    const taskCache = new Map<string, Task | null>();
    const getTask = async (taskId: Uuid): Promise<Task | null> => {
      const key = taskId.value;
      if (!taskCache.has(key)) {
        taskCache.set(key, await this.taskRepository.getById(taskId));
      }
      return taskCache.get(key) ?? null;
    };

    const sessionSummaries: StudentAnalysisAiInput["sessions"] = [];
    for (const session of sessions) {
      const answers = [];
      let correctAnswers = 0;
      let totalTime = 0;

      for (const answer of session.answers) {
        const task = await getTask(answer.taskId);
        if (answer.isCorrect) correctAnswers++;
        totalTime += answer.timeToAnswer;

        answers.push({
          taskPrompt: task?.prompt,
          category: task?.category,
          isCorrect: answer.isCorrect,
          timeToAnswer: answer.timeToAnswer,
        });
      }

      sessionSummaries.push({
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
      });
    }

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

    if (request.templateId) {
      const anamnese = await this.buildAnamnese(
        request.templateId,
        request.studentId
      );
      if (anamnese) {
        input.anamnese = anamnese;
      }
    }

    let analysis: string;
    try {
      analysis = await this.aiStudentAnalysisService.generate(input);
    } catch {
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
