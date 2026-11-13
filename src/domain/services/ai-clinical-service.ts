import { CriterionResult } from "../entities/session-evolution";
import { BandSeverity, ScoringMethod } from "../entities/scale-template";

// Do cadastro do aluno só saem idade e gênero (IA-05). Nunca nome, endereço,
// telefone, documentos, foto ou dados do responsável.
export interface ClinicalAiStudent {
  age: number;
  gender: string;
}

export interface NextSessionSuggestionParams {
  student: ClinicalAiStudent;
  // Metas abertas do plano escolhido pela regra EV-12; ausente sem plano.
  planGoals?: { description: string; successCriterion?: string }[];
  session: {
    durationMinutes?: number;
    answeredCount: number;
    correctCount: number;
  };
  criteria: {
    description: string;
    successCriterion?: string;
    attempts?: number;
    successes?: number;
    result: CriterionResult;
    note?: string;
  }[];
  descriptiveRecord?: string;
  recentEvolutions: {
    sessionDate: string;
    achievedCount: number;
    criteriaCount: number;
    excerpt: string;
  }[];
}

export interface NextSessionSuggestionOutput {
  suggestion: string;
  rationale?: string;
}

export interface ClinicalAiBand {
  label: string;
  severity: BandSeverity;
}

// Só o escore agregado: as respostas item a item não vão ao provedor (IN-03).
export interface ScaleInsightParams {
  student: ClinicalAiStudent;
  scale: {
    name: string;
    method: ScoringMethod;
    bands: {
      subscaleCode?: string;
      min: number;
      max: number;
      label: string;
      severity: BandSeverity;
    }[];
  };
  score: {
    partial: boolean;
    answered: number;
    total: number;
    value: number;
    max: number;
    band?: ClinicalAiBand;
    subscales: {
      code: string;
      name: string;
      value: number;
      max: number;
      band?: ClinicalAiBand;
    }[];
  };
  preliminary: boolean;
}

// Respostas do tipo arquivo não entram (AS-03).
export interface AnamneseSummaryParams {
  student: ClinicalAiStudent;
  anamnese: {
    templateTitle?: string;
    answers: { question: string; answer: string }[];
  };
}

export interface ClinicalTextOutput {
  text: string;
}

// Lança AiInvalidOutputError (ai-errors) quando a resposta do
// modelo não dá para interpretar.
export interface AiClinicalService {
  nextSessionSuggestion(
    params: NextSessionSuggestionParams
  ): Promise<NextSessionSuggestionOutput>;
  scaleInsight(params: ScaleInsightParams): Promise<ClinicalTextOutput>;
  anamneseSummary(params: AnamneseSummaryParams): Promise<ClinicalTextOutput>;
}
