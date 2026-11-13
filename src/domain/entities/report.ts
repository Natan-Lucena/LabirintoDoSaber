import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { isValidDateOnly } from "../utils/date-only";

export enum ReportType {
  PROGRESS = "PROGRESS",
  ASSESSMENT = "ASSESSMENT",
  PDI_PROGRESS = "PDI_PROGRESS",
}

export enum ReportSection {
  PATIENT_DATA = "PATIENT_DATA",
  SESSION_METRICS = "SESSION_METRICS",
  EVOLUTIONS = "EVOLUTIONS",
  PLAN_PROGRESS = "PLAN_PROGRESS",
  ASSESSMENTS = "ASSESSMENTS",
  ANAMNESIS_SUMMARY = "ANAMNESIS_SUMMARY",
  AI_SYNTHESIS = "AI_SYNTHESIS",
}

export enum ReportAudience {
  FAMILY = "FAMILY",
  SCHOOL = "SCHOOL",
  PROFESSIONAL = "PROFESSIONAL",
}

export enum ReportShareChannel {
  SHARE = "SHARE",
  PRINT = "PRINT",
}

export const MAX_REPORT_PERIOD_DAYS = 365;

// Seções permitidas por tipo, na ordem em que aparecem no documento.
export const REPORT_ALLOWED_SECTIONS: Record<ReportType, ReportSection[]> = {
  [ReportType.PROGRESS]: [
    ReportSection.PATIENT_DATA,
    ReportSection.SESSION_METRICS,
    ReportSection.EVOLUTIONS,
    ReportSection.PLAN_PROGRESS,
    ReportSection.AI_SYNTHESIS,
  ],
  [ReportType.ASSESSMENT]: [
    ReportSection.PATIENT_DATA,
    ReportSection.ASSESSMENTS,
    ReportSection.ANAMNESIS_SUMMARY,
    ReportSection.AI_SYNTHESIS,
  ],
  [ReportType.PDI_PROGRESS]: [
    ReportSection.PATIENT_DATA,
    ReportSection.PLAN_PROGRESS,
    ReportSection.EVOLUTIONS,
    ReportSection.AI_SYNTHESIS,
  ],
};

// Seções com dado clínico sensível: fora dos padrões de FAMILY e SCHOOL (RP-01).
export const SENSITIVE_REPORT_SECTIONS: ReportSection[] = [
  ReportSection.ASSESSMENTS,
  ReportSection.ANAMNESIS_SUMMARY,
];

// Retrato do relatório na geração (RP-03). Montado campo a campo: nunca entram
// endereço, telefones, documentos, foto, responsável nem CPF (RP-01).
export interface ReportContent {
  title: string;
  generatedAt: string;
  professional: { name: string; profession?: string };
  patient?: { displayName: string; ageYears: number; schoolGrade?: string };
  sessionMetrics?: {
    sessions: number;
    answered: number;
    accuracy: number;
    byCategory: { category: string; accuracy: number }[];
  };
  evolutions?: {
    sessionDate: string;
    planTitle?: string;
    achieved: number;
    total: number;
    record: string;
  }[];
  planProgress?: {
    title: string;
    type: "PDI" | "PE";
    percent: number;
    goals: { description: string; status: string }[];
  }[];
  assessments?: {
    templateName: string;
    completedAt: string;
    value: number;
    max: number;
    band?: string;
  }[];
  anamnesisSummary?: string;
  synthesis?: string;
}

export interface ReportShare {
  channel: ReportShareChannel;
  at: Date;
}

// Tudo menos o conteúdo: é o que a listagem carrega.
export interface ReportSummaryProps {
  id: Uuid;
  studentId: Uuid;
  studentName: string;
  educatorId: Uuid;
  type: ReportType;
  audience: ReportAudience;
  periodFrom: string;
  periodTo: string;
  sections: ReportSection[];
  synthesisFailed: boolean;
  shares: ReportShare[];
  createdAt: Date;
}

export interface ReportProps extends ReportSummaryProps {
  content: ReportContent;
}

export interface ReportRequestProps {
  type: ReportType;
  sections: ReportSection[];
  periodFrom: string;
  periodTo: string;
}

export interface CreateReportProps extends ReportRequestProps {
  studentId: Uuid;
  studentName: string;
  educatorId: Uuid;
  audience: ReportAudience;
  content: ReportContent;
  synthesisFailed: boolean;
}

export type ReportError = "INVALID_PERIOD" | "NO_SECTIONS" | "SECTION_NOT_ALLOWED";

const DAY_MS = 24 * 60 * 60 * 1000;

const daysBetween = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;

export class Report {
  private constructor(private readonly props: ReportProps) {}

  // RP-04. Devolve as seções sem repetição, na ordem do tipo.
  static validateRequest(props: ReportRequestProps) {
    const { periodFrom, periodTo } = props;
    if (
      !isValidDateOnly(periodFrom) ||
      !isValidDateOnly(periodTo) ||
      periodFrom > periodTo ||
      daysBetween(periodFrom, periodTo) > MAX_REPORT_PERIOD_DAYS
    ) {
      return failure<ReportError>("INVALID_PERIOD");
    }

    if (props.sections.length === 0) return failure<ReportError>("NO_SECTIONS");

    const allowed = REPORT_ALLOWED_SECTIONS[props.type];
    if (props.sections.some((section) => !allowed.includes(section))) {
      return failure<ReportError>("SECTION_NOT_ALLOWED");
    }

    return success(allowed.filter((section) => props.sections.includes(section)));
  }

  static create(props: CreateReportProps) {
    const sections = Report.validateRequest(props);
    if (!sections.ok) return sections;

    return success(
      new Report({
        id: Uuid.random(),
        studentId: props.studentId,
        studentName: props.studentName,
        educatorId: props.educatorId,
        type: props.type,
        audience: props.audience,
        periodFrom: props.periodFrom,
        periodTo: props.periodTo,
        sections: sections.value,
        content: props.content,
        synthesisFailed: props.synthesisFailed,
        shares: [],
        createdAt: new Date(),
      })
    );
  }

  static fromPersistence(props: ReportProps): Report {
    return new Report(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get studentId(): Uuid {
    return this.props.studentId;
  }

  get studentName(): string {
    return this.props.studentName;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get type(): ReportType {
    return this.props.type;
  }

  get audience(): ReportAudience {
    return this.props.audience;
  }

  get periodFrom(): string {
    return this.props.periodFrom;
  }

  get periodTo(): string {
    return this.props.periodTo;
  }

  get sections(): ReportSection[] {
    return this.props.sections;
  }

  get content(): ReportContent {
    return this.props.content;
  }

  get synthesisFailed(): boolean {
    return this.props.synthesisFailed;
  }

  get shares(): ReportShare[] {
    return this.props.shares;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // RP-08: só registra; o envio em si é do app.
  share(channel: ReportShareChannel, at: Date = new Date()) {
    return new Report({ ...this.props, shares: [...this.props.shares, { channel, at }] });
  }
}
