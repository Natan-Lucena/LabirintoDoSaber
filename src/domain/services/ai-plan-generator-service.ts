import { GoalStatus, PlanType } from "../entities/plan";

export interface PlanAiCategoryMetric {
  category: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface PlanAiObservation {
  sessionDate: string;
  observation: string;
}

export interface PlanAiGoal {
  description: string;
  successCriterion?: string;
}

/**
 * Contexto do paciente enviado à IA. Nunca contém nome, endereço, telefone,
 * documentos ou fotos do paciente.
 */
export interface PlanAiContext {
  student: { age: number; gender: string };
  focus: string;
  consideredDifficulties: string[];
  metrics: {
    total: { total: number; correct: number; accuracy: number };
    categories: PlanAiCategoryMetric[];
  };
  recentObservations: PlanAiObservation[];
  anamnese?: {
    templateTitle?: string;
    answers: { question: string; answer: string }[];
  };
  parentGoals?: PlanAiGoal[];
  hasSessionHistory: boolean;
}

export interface GeneratePlanDraftParams {
  type: PlanType;
  // Só no PDI.
  durationMonths?: number;
  context: PlanAiContext;
}

export interface PlanDraftOutput {
  title: string;
  generalObjective: string;
  goals: PlanAiGoal[];
  rationale?: string;
}

// Lançado quando o modelo devolve algo que não dá para interpretar (JSON
// quebrado ou fora do formato). O use case traduz para AI_INVALID_OUTPUT.
export class AiInvalidOutputError extends Error {
  constructor() {
    super("AI_INVALID_OUTPUT");
    this.name = "AiInvalidOutputError";
  }
}

// Plano atual enviado à IA para sugerir ajustes. Os ids das metas são os
// reais, para o modelo apontar a meta certa.
export interface PlanAiSuggestionPlan {
  type: PlanType;
  generalObjective: string;
  startDate: string;
  endDate: string;
  nextReviewDate?: string;
  today: string;
  goals: { id: string; description: string; successCriterion?: string; status: GoalStatus }[];
}

export interface GeneratePlanSuggestionsParams {
  context: PlanAiContext;
  plan: PlanAiSuggestionPlan;
  max: number;
}

// Saída crua do modelo; o use case valida cada item com a entidade.
export interface PlanSuggestionOutput {
  kind: string;
  goalId?: string;
  text: string;
  proposedChange: {
    status?: string;
    description?: string;
    successCriterion?: string;
    nextReviewDate?: string;
  };
}

export interface AiPlanGeneratorService {
  generateDraft(params: GeneratePlanDraftParams): Promise<PlanDraftOutput>;
  generateSuggestions(params: GeneratePlanSuggestionsParams): Promise<PlanSuggestionOutput[]>;
}
