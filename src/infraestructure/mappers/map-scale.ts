import { ScaleApplication } from "../../domain/entities/scale-application";
import { ScaleScore, ScaleTemplate } from "../../domain/entities/scale-template";

export function mapScaleTemplateToResponse(template: ScaleTemplate) {
  return {
    id: template.id.value,
    code: template.code,
    version: template.version,
    name: template.name,
    description: template.description,
    instructions: template.instructions,
    respondent: template.respondent,
    ageRange: template.ageRange,
    estimatedMinutes: template.estimatedMinutes,
    options: template.options.map((option) => ({ value: option.value, label: option.label })),
    items: template.items.map((item) => ({
      id: item.id,
      order: item.order,
      text: item.text,
      subscaleCode: item.subscaleCode,
    })),
    subscales: template.subscales.map((subscale) => ({
      code: subscale.code,
      name: subscale.name,
    })),
    scoring: {
      method: template.scoring.method,
      bands: template.scoring.bands.map((band) => ({
        subscaleCode: band.subscaleCode,
        min: band.min,
        max: band.max,
        label: band.label,
        severity: band.severity,
      })),
    },
    disclaimer: template.disclaimer,
    reference: template.reference,
    active: template.active,
  };
}

export function mapScaleTemplateToSummary(template: ScaleTemplate) {
  return {
    id: template.id.value,
    code: template.code,
    version: template.version,
    name: template.name,
    description: template.description,
    respondent: template.respondent,
    ageRange: template.ageRange,
    estimatedMinutes: template.estimatedMinutes,
    itemCount: template.items.length,
  };
}

export function mapScaleScore(score: ScaleScore) {
  return {
    partial: score.partial,
    answered: score.answered,
    total: score.total,
    value: score.value,
    max: score.max,
    band: score.band,
    subscales: score.subscales.map((subscale) => ({
      code: subscale.code,
      name: subscale.name,
      answered: subscale.answered,
      total: subscale.total,
      value: subscale.value,
      max: subscale.max,
      band: subscale.band,
    })),
  };
}

// O template precisa ser o da versão gravada na aplicação (AV-02): o escore
// é sempre recalculado com ele, nunca lido do banco.
function mapApplicationFields(
  application: ScaleApplication,
  template: ScaleTemplate,
  studentName: string
) {
  return {
    id: application.id.value,
    templateId: application.templateId.value,
    templateCode: application.templateCode,
    templateVersion: application.templateVersion,
    templateName: application.templateName,
    studentId: application.studentId.value,
    studentName,
    educatorId: application.educatorId.value,
    appointmentId: application.appointmentId?.value,
    status: application.status,
    score: mapScaleScore(template.computeScore(application.answers)),
    insight: application.insight
      ? {
          text: application.insight.text,
          generatedAt: application.insight.generatedAt,
          preliminary: application.insight.preliminary,
        }
      : undefined,
    // AV-09: o aviso vai em toda resposta de aplicação.
    disclaimer: template.disclaimer,
    startedAt: application.startedAt,
    updatedAt: application.updatedAt,
    completedAt: application.completedAt,
  };
}

export function mapScaleApplicationToResponse(
  application: ScaleApplication,
  template: ScaleTemplate,
  studentName: string
) {
  return {
    ...mapApplicationFields(application, template, studentName),
    answers: application.answers.map((answer) => ({
      itemId: answer.itemId,
      value: answer.value,
    })),
  };
}

export function mapScaleApplicationToSummary(
  application: ScaleApplication,
  template: ScaleTemplate,
  studentName: string
) {
  return mapApplicationFields(application, template, studentName);
}
