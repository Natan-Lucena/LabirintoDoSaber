import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { PlanStatus } from "../../../domain/entities/plan";
import { ApplicationStatus } from "../../../domain/entities/scale-application";
import { CriterionResult } from "../../../domain/entities/session-evolution";
import { Student } from "../../../domain/entities/student";
import {
  ReportAudience,
  ReportContent,
  ReportSection,
  ReportType,
} from "../../../domain/entities/report";
import { AnamneseResponseRepository } from "../../../domain/repositories/anamnese-response-repository";
import { PlanRepository } from "../../../domain/repositories/plan-repository";
import { ScaleApplicationRepository } from "../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../domain/repositories/scale-template-repository";
import { SessionEvolutionRepository } from "../../../domain/repositories/session-evolution-repository";
import { ReportSynthesisParams } from "../../../domain/services/ai-clinical-service";
import { REPORT_TYPE_LABELS } from "../../../domain/services/report-options";
import {
  endOfDayInSaoPaulo,
  startOfDayInSaoPaulo,
} from "../../../domain/utils/date-only";
import { GenerateStudentAnalysisUseCase } from "../task-notebook-session/use-cases/generate-student-analisys/generate-student-analisys-use-case";

// Teto de itens por seção num período de até 365 dias.
const EVOLUTIONS_LIMIT = 200;
const ASSESSMENTS_LIMIT = 100;

type Defined<T> = Exclude<T, undefined>;

// Dados do período para todas as seções; o conteúdo usa só as pedidas.
export interface ReportPeriodData {
  sessionMetrics: Defined<ReportContent["sessionMetrics"]>;
  evolutions: Defined<ReportContent["evolutions"]>;
  planProgress: Defined<ReportContent["planProgress"]>;
  assessments: Defined<ReportContent["assessments"]>;
  anamnesisSummary?: string;
}

export interface ReportPeriod {
  from: string;
  to: string;
}

export interface ReportContentBuilderDeps {
  analysisUseCase: GenerateStudentAnalysisUseCase;
  evolutionRepository: SessionEvolutionRepository;
  planRepository: PlanRepository;
  applicationRepository: ScaleApplicationRepository;
  templateRepository: ScaleTemplateRepository;
  anamneseResponseRepository: AnamneseResponseRepository;
}

export interface AssembleReportContentParams {
  data: ReportPeriodData;
  type: ReportType;
  sections: ReportSection[];
  student: Student;
  professional: { name: string; profession?: string };
  generatedAt: Date;
}

export class ReportContentBuilder {
  constructor(private deps: ReportContentBuilderDeps) {}

  // Reúne o período. As consultas são independentes e rodam em paralelo.
  async load(student: Student, period: ReportPeriod) {
    const [metrics, evolutions, planProgress, assessments, anamnesisSummary] =
      await Promise.all([
        this.loadSessionMetrics(student, period),
        this.loadEvolutions(student, period),
        this.loadPlanProgress(student, period),
        this.loadAssessments(student, period),
        this.loadAnamnesisSummary(student),
      ]);
    if (!metrics.ok) return metrics;

    return success<ReportPeriodData>({
      sessionMetrics: metrics.value,
      evolutions,
      planProgress,
      assessments,
      anamnesisSummary,
    });
  }

  // Sessões finalizadas no período, com o cálculo de acerto da análise do aluno.
  private async loadSessionMetrics(student: Student, period: ReportPeriod) {
    const analysis = await this.deps.analysisUseCase.loadAnalysisData({
      studentId: student.id.value,
      finishedBetween: period,
    });
    if (!analysis.ok) return failure(analysis.error);

    const { sessions, total, categories } = analysis.value;
    return success<ReportPeriodData["sessionMetrics"]>({
      sessions: sessions.length,
      answered: total.total,
      accuracy: total.accuracy,
      byCategory: Object.values(categories)
        .filter((category) => category.total > 0)
        .map((category) => ({ category: category.category, accuracy: category.accuracy })),
    });
  }

  // Em ordem cronológica, para leitura do documento.
  private async loadEvolutions(student: Student, period: ReportPeriod) {
    const evolutions = await this.deps.evolutionRepository.search({
      studentIds: [student.id],
      from: period.from,
      to: period.to,
      limit: EVOLUTIONS_LIMIT,
    });

    return [...evolutions].reverse().map((evolution) => ({
      sessionDate: evolution.sessionDate,
      ...(evolution.planTitle ? { planTitle: evolution.planTitle } : {}),
      achieved: evolution.criteria.filter(
        (criterion) => criterion.result === CriterionResult.ACHIEVED
      ).length,
      total: evolution.criteria.length,
      record: evolution.descriptiveRecord,
    }));
  }

  // Planos ativos ou concluídos com vigência no período; cancelados não entram.
  // Plano ativo fora do período também não entra.
  private async loadPlanProgress(student: Student, period: ReportPeriod) {
    const plans = await this.deps.planRepository.search({
      educatorId: student.educatorId,
      studentId: student.id,
    });

    return plans
      .filter(
        (plan) =>
          (plan.status === PlanStatus.ACTIVE || plan.status === PlanStatus.COMPLETED) &&
          plan.startDate <= period.to &&
          plan.endDate >= period.from
      )
      .map((plan) => ({
        title: plan.title,
        type: plan.type,
        percent: plan.progress.percent,
        goals: plan.goals.map((goal) => ({
          description: goal.description,
          status: goal.status,
        })),
      }));
  }

  // Aplicações concluídas no período; escore com o template da versão gravada.
  private async loadAssessments(student: Student, period: ReportPeriod) {
    const applications = await this.deps.applicationRepository.search({
      studentIds: [student.id],
      status: ApplicationStatus.COMPLETED,
      completedFrom: startOfDayInSaoPaulo(period.from),
      completedTo: endOfDayInSaoPaulo(period.to),
      limit: ASSESSMENTS_LIMIT,
    });

    const templateIds = [
      ...new Set(applications.map((application) => application.templateId.value)),
    ];
    const templates = templateIds.length
      ? await this.deps.templateRepository.findByIds(templateIds.map((id) => new Uuid(id)))
      : [];
    const templateById = new Map(templates.map((template) => [template.id.value, template]));

    return applications
      .filter((application) => application.completedAt)
      .sort((a, b) => a.completedAt!.getTime() - b.completedAt!.getTime())
      .flatMap((application) => {
        const template = templateById.get(application.templateId.value);
        if (!template) return [];
        const score = template.computeScore(application.answers);
        return [
          {
            templateName: application.templateName,
            completedAt: application.completedAt!.toISOString(),
            value: score.value,
            max: score.max,
            ...(score.band ? { band: score.band.label } : {}),
          },
        ];
      });
  }

  // A síntese mais recente entre as anamneses do aluno, sem limite de período.
  private async loadAnamnesisSummary(student: Student) {
    const responses = await this.deps.anamneseResponseRepository.listByStudentId(student.id);

    let latest: { text: string; generatedAt: Date } | undefined;
    for (const response of responses) {
      const summary = response.summary;
      if (summary && (!latest || summary.generatedAt > latest.generatedAt)) {
        latest = summary;
      }
    }
    return latest?.text;
  }
}

// RP-05: nenhuma das seções pedidas que trazem dados (todas menos PATIENT_DATA
// e AI_SYNTHESIS) tem dado no período. Assim a IA nunca é chamada sem dados.
export function isEmptyPeriod(data: ReportPeriodData, sections: ReportSection[]): boolean {
  const hasData: Partial<Record<ReportSection, boolean>> = {
    [ReportSection.SESSION_METRICS]: data.sessionMetrics.sessions > 0,
    [ReportSection.EVOLUTIONS]: data.evolutions.length > 0,
    [ReportSection.PLAN_PROGRESS]: data.planProgress.length > 0,
    [ReportSection.ASSESSMENTS]: data.assessments.length > 0,
    [ReportSection.ANAMNESIS_SUMMARY]: Boolean(data.anamnesisSummary),
  };
  return !sections.some((section) => hasData[section]);
}

// Monta o retrato campo a campo, só com as seções pedidas. Do cadastro do aluno
// saem só nome e idade: nunca endereço, telefones, documentos, foto ou
// responsável (RP-01). A síntese da IA entra depois.
export function assembleReportContent(params: AssembleReportContentParams): ReportContent {
  const { data, sections, professional } = params;
  const has = (section: ReportSection) => sections.includes(section);

  const content: ReportContent = {
    title: REPORT_TYPE_LABELS[params.type].label,
    generatedAt: params.generatedAt.toISOString(),
    professional: {
      name: professional.name,
      ...(professional.profession ? { profession: professional.profession } : {}),
    },
  };

  if (has(ReportSection.PATIENT_DATA)) {
    content.patient = { displayName: params.student.name, ageYears: params.student.age };
  }
  if (has(ReportSection.SESSION_METRICS)) content.sessionMetrics = data.sessionMetrics;
  if (has(ReportSection.EVOLUTIONS)) content.evolutions = data.evolutions;
  if (has(ReportSection.PLAN_PROGRESS)) content.planProgress = data.planProgress;
  if (has(ReportSection.ASSESSMENTS)) content.assessments = data.assessments;
  if (has(ReportSection.ANAMNESIS_SUMMARY) && data.anamnesisSummary) {
    content.anamnesisSummary = data.anamnesisSummary;
  }

  return content;
}

// Entrada da IA: as seções já montadas, sem o paciente e sem o profissional
// (nenhum nome vai ao provedor, IA-05). Do aluno, só idade e gênero.
export function buildSynthesisParams(params: {
  content: ReportContent;
  student: Student;
  audience: ReportAudience;
  type: ReportType;
  period: ReportPeriod;
}): ReportSynthesisParams {
  const { content } = params;
  const synthesis: ReportSynthesisParams = {
    student: { age: params.student.age, gender: params.student.gender },
    audience: params.audience,
    reportType: params.type,
    period: { from: params.period.from, to: params.period.to },
  };

  if (content.sessionMetrics) synthesis.sessionMetrics = content.sessionMetrics;
  if (content.evolutions) synthesis.evolutions = content.evolutions;
  if (content.planProgress) synthesis.planProgress = content.planProgress;
  if (content.assessments) synthesis.assessments = content.assessments;
  if (content.anamnesisSummary) synthesis.anamnesisSummary = content.anamnesisSummary;

  return synthesis;
}
