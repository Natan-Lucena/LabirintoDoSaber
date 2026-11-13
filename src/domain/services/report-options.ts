import {
  MAX_REPORT_PERIOD_DAYS,
  REPORT_ALLOWED_SECTIONS,
  ReportAudience,
  ReportSection,
  ReportType,
  SENSITIVE_REPORT_SECTIONS,
} from "../entities/report";

export interface ReportOptions {
  types: {
    type: ReportType;
    label: string;
    description: string;
    allowedSections: ReportSection[];
    defaultSections: ReportSection[];
  }[];
  sections: { section: ReportSection; label: string; sensitive: boolean }[];
  audiences: { audience: ReportAudience; label: string }[];
  periods: { key: string; label: string; days: number }[];
  maxPeriodDays: number;
}

export const REPORT_TYPE_LABELS: Record<ReportType, { label: string; description: string }> = {
  [ReportType.PROGRESS]: {
    label: "Relatório de progresso",
    description: "Sessões, evoluções e andamento dos planos no período.",
  },
  [ReportType.ASSESSMENT]: {
    label: "Relatório de avaliação",
    description: "Escalas aplicadas no período e síntese da anamnese.",
  },
  [ReportType.PDI_PROGRESS]: {
    label: "Relatório de PDI",
    description: "Andamento das metas do plano e evoluções das sessões.",
  },
};

const SECTION_LABELS: Record<ReportSection, string> = {
  [ReportSection.PATIENT_DATA]: "Dados do paciente",
  [ReportSection.SESSION_METRICS]: "Métricas das sessões",
  [ReportSection.EVOLUTIONS]: "Evoluções das sessões",
  [ReportSection.PLAN_PROGRESS]: "Progresso dos planos",
  [ReportSection.ASSESSMENTS]: "Avaliações e escalas",
  [ReportSection.ANAMNESIS_SUMMARY]: "Síntese da anamnese",
  [ReportSection.AI_SYNTHESIS]: "Síntese do período (IA)",
};

const AUDIENCE_LABELS: Record<ReportAudience, string> = {
  [ReportAudience.FAMILY]: "Família",
  [ReportAudience.SCHOOL]: "Escola",
  [ReportAudience.PROFESSIONAL]: "Outro profissional",
};

// Opções estáticas do formulário. Os padrões são todas as seções permitidas;
// o app tira as `sensitive` para FAMILY e SCHOOL (RP-01).
export const REPORT_OPTIONS: ReportOptions = {
  types: Object.values(ReportType).map((type) => ({
    type,
    label: REPORT_TYPE_LABELS[type].label,
    description: REPORT_TYPE_LABELS[type].description,
    allowedSections: [...REPORT_ALLOWED_SECTIONS[type]],
    defaultSections: [...REPORT_ALLOWED_SECTIONS[type]],
  })),
  sections: Object.values(ReportSection).map((section) => ({
    section,
    label: SECTION_LABELS[section],
    sensitive: SENSITIVE_REPORT_SECTIONS.includes(section),
  })),
  audiences: Object.values(ReportAudience).map((audience) => ({
    audience,
    label: AUDIENCE_LABELS[audience],
  })),
  periods: [
    { key: "30d", label: "Últimos 30 dias", days: 30 },
    { key: "90d", label: "Últimos 90 dias", days: 90 },
    { key: "180d", label: "Últimos 180 dias", days: 180 },
  ],
  maxPeriodDays: MAX_REPORT_PERIOD_DAYS,
};
