export interface StudentAnalysisCategoryMetric {
  category: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface StudentAnalysisSessionAnswer {
  taskPrompt?: string;
  category?: string;
  isCorrect: boolean;
  timeToAnswer: number;
}

export interface StudentAnalysisSessionSummary {
  name: string;
  startedAt: string;
  finishedAt?: string;
  observation?: string;
  totalAnswers: number;
  correctAnswers: number;
  averageTimeToAnswer?: number;
  answers: StudentAnalysisSessionAnswer[];
}

export interface StudentAnalysisAnamneseAnswer {
  question: string;
  answer: string;
}

/**
 * Retrato completo do aluno enviado à IA para a análise psicopedagógica.
 * Reúne perfil, métricas agregadas, histórico de sessões e (opcionalmente) a
 * anamnese — quanto mais rico, melhor a análise.
 */
export interface StudentAnalysisAiInput {
  student: {
    name: string;
    age: number;
    gender: string;
    learningTopics: string[];
  };
  period?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  };
  metrics: {
    total: { total: number; correct: number; accuracy: number };
    categories: StudentAnalysisCategoryMetric[];
  };
  sessions: StudentAnalysisSessionSummary[];
  anamnese?: {
    templateTitle?: string;
    answers: StudentAnalysisAnamneseAnswer[];
  };
}

export interface AiStudentAnalysisService {
  generate(input: StudentAnalysisAiInput): Promise<string>;
}
