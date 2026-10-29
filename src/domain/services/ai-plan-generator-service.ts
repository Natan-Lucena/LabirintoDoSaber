import { PlanType } from "../entities/plan";

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

export interface AiPlanGeneratorService {
  generateDraft(params: GeneratePlanDraftParams): Promise<PlanDraftOutput>;
}
