import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ApplicationStatus } from "../../../../../domain/entities/scale-application";
import {
  AiClinicalService,
  ScaleInsightParams,
} from "../../../../../domain/services/ai-clinical-service";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { callClinicalAi, clipAiText } from "../../../../services/clinical-ai-call";
import { loadOwnedApplication, ScaleApplicationView } from "../application-access";

const INSIGHT_MAX = 800;

export interface GenerateInsightUseCaseRequest {
  educatorId: Uuid;
  applicationId: string;
}

// §4.6: insight sob demanda (IN-01), em DRAFT ou COMPLETED. Gerar de novo
// substitui o anterior (IN-02).
export class GenerateInsightUseCase {
  constructor(
    private applicationRepository: ScaleApplicationRepository,
    private templateRepository: ScaleTemplateRepository,
    private studentRepository: StudentRepository,
    private aiClinicalService: AiClinicalService
  ) {}

  async execute(request: GenerateInsightUseCaseRequest) {
    const access = await loadOwnedApplication(
      this.applicationRepository,
      this.studentRepository,
      request.applicationId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { application, student } = access.value;

    // Template da versão gravada na aplicação (AV-02).
    const template = await this.templateRepository.findById(application.templateId);
    if (!template) return failure("SCALE_NOT_FOUND");

    const preliminary = application.status !== ApplicationStatus.COMPLETED;
    const score = template.computeScore(application.answers);

    // Só o escore agregado: as respostas item a item ficam fora (IN-03).
    const params: ScaleInsightParams = {
      student: { age: student.age, gender: student.gender },
      scale: {
        name: template.name,
        method: template.scoring.method,
        bands: template.scoring.bands.map((band) => ({
          subscaleCode: band.subscaleCode,
          min: band.min,
          max: band.max,
          label: band.label,
          severity: band.severity,
        })),
      },
      score: {
        partial: score.partial,
        answered: score.answered,
        total: score.total,
        value: score.value,
        max: score.max,
        band: score.band,
        subscales: score.subscales.map((subscale) => ({
          code: subscale.code,
          name: subscale.name,
          value: subscale.value,
          max: subscale.max,
          band: subscale.band,
        })),
      },
      preliminary,
    };

    const output = await callClinicalAi("generate-scale-insight", () =>
      this.aiClinicalService.scaleInsight(params)
    );
    if (!output.ok) return output;

    const text = clipAiText(output.value?.text, INSIGHT_MAX);
    if (!text) return failure("AI_INVALID_OUTPUT");

    const updated = application.withInsight({
      text,
      generatedAt: new Date(),
      preliminary,
    });
    await this.applicationRepository.save(updated);

    return success<ScaleApplicationView>({
      application: updated,
      template,
      studentName: student.name,
    });
  }
}
