import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { AiClinicalService } from "../../../../../domain/services/ai-clinical-service";
import { AnamneseContextBuilder } from "../../../../services/anamnese-context-builder";
import { callClinicalAi, clipAiText } from "../../../../services/clinical-ai-call";

const SUMMARY_MAX = 1500;

export interface GenerateAnamneseSummaryUseCaseRequest {
  educatorId: Uuid;
  responseId: string;
}

// §5: síntese da anamnese por IA, gravada na resposta. Gerar de novo
// substitui a anterior.
export class GenerateAnamneseSummaryUseCase {
  constructor(
    private responseRepository: AnamneseResponseRepository,
    private templateRepository: AnamneseTemplateRepository,
    private studentRepository: StudentRepository,
    private anamneseBuilder: AnamneseContextBuilder,
    private aiClinicalService: AiClinicalService
  ) {}

  async execute(request: GenerateAnamneseSummaryUseCaseRequest) {
    if (!Uuid.isValid(request.responseId)) return failure("RESPONSE_NOT_FOUND");

    const response = await this.responseRepository.findById(new Uuid(request.responseId));
    if (!response) return failure("RESPONSE_NOT_FOUND");

    // Mesmo critério de dono da leitura da resposta (AS-01).
    if (response.educatorId.value !== request.educatorId.value) {
      return failure("UNAUTHORIZED");
    }

    const [template, student] = await Promise.all([
      this.templateRepository.findById(response.templateId),
      this.studentRepository.getById(response.studentId),
    ]);
    if (!template) return failure("TEMPLATE_NOT_FOUND");
    if (!student) return failure("STUDENT_NOT_FOUND");

    // Respostas do tipo arquivo não vão ao provedor (AS-03).
    const anamnese = this.anamneseBuilder.buildFromResponse(template, response, {
      omitFileUrls: true,
      skipFileAnswers: true,
    });
    if (anamnese.answers.length === 0) return failure("NO_ANSWERS_TO_SUMMARIZE");

    // Antes da chamada: uma edição feita enquanto a IA responde fica depois
    // da síntese e deixa summaryOutdated = true (AS-02).
    const generatedAt = new Date();

    const output = await callClinicalAi("generate-anamnese-summary", () =>
      this.aiClinicalService.anamneseSummary({
        student: { age: student.age, gender: student.gender },
        anamnese,
      })
    );
    if (!output.ok) return output;

    const text = clipAiText(output.value?.text, SUMMARY_MAX);
    if (!text) return failure("AI_INVALID_OUTPUT");

    // Grava só a síntese, para não regravar as respostas lidas antes da IA.
    const saved = await this.responseRepository.saveSummary(response.id, {
      text,
      generatedAt,
    });
    if (!saved) return failure("RESPONSE_NOT_FOUND");

    const current = await this.responseRepository.findById(response.id);
    if (!current) return failure("RESPONSE_NOT_FOUND");

    return success(current);
  }
}
