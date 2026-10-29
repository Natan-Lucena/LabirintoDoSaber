import { failure, success } from "@wave-telecom/framework/core";
import { AnamneseTemplate } from "../../../../domain/entities/anamnese-template";
import { Plan } from "../../../../domain/entities/plan";
import { Student } from "../../../../domain/entities/student";
import { todayInSaoPaulo } from "../../../../domain/utils/date-only";
import { PlanAiContext } from "../../../../domain/services/ai-plan-generator-service";
import { AnamneseContextBuilder } from "../../../services/anamnese-context-builder";
import { GenerateStudentAnalysisUseCase } from "../../task-notebook-session/use-cases/generate-student-analisys/generate-student-analisys-use-case";

const SESSIONS_LIMIT = 10;
const OBSERVATIONS_LIMIT = 5;

export interface BuildPlanAiContextParams {
  student: Student;
  focus: string;
  consideredDifficulties: string[];
  analysisUseCase: GenerateStudentAnalysisUseCase;
  anamneseBuilder: AnamneseContextBuilder;
  // Template já carregado e com o dono conferido pelo use case.
  template?: AnamneseTemplate;
  parentPlan?: Plan;
}

// Monta o contexto do paciente para a IA. Só idade e gênero saem do cadastro:
// nome, endereço, telefone, documentos e foto nunca entram aqui.
export async function buildPlanAiContext(params: BuildPlanAiContextParams) {
  const studentId = params.student.id.value;

  const [analysis, anamnese] = await Promise.all([
    params.analysisUseCase.loadAnalysisData({
      studentId,
      limit: SESSIONS_LIMIT,
    }),
    params.template
      ? params.anamneseBuilder.buildFromTemplate(params.template, studentId, {
          omitFileUrls: true,
        })
      : Promise.resolve(null),
  ]);

  if (!analysis.ok) return failure(analysis.error);

  const { sessions, total, categories } = analysis.value;

  // loadAnalysisData com limit já devolve as sessões mais recentes primeiro.
  const recentObservations = sessions
    .filter((session) => session.finishedAt && session.observation)
    .slice(0, OBSERVATIONS_LIMIT)
    .map((session) => ({
      sessionDate: todayInSaoPaulo(session.startedAt),
      observation: session.observation as string,
    }));

  const context: PlanAiContext = {
    student: {
      age: params.student.age,
      gender: params.student.gender,
    },
    focus: params.focus,
    consideredDifficulties: params.consideredDifficulties,
    metrics: {
      total,
      categories: Object.values(categories),
    },
    recentObservations,
    hasSessionHistory: sessions.some((session) => session.finishedAt),
  };

  if (anamnese) {
    context.anamnese = anamnese;
  }

  if (params.parentPlan) {
    context.parentGoals = params.parentPlan.goals.map((goal) => ({
      description: goal.description,
      successCriterion: goal.successCriterion,
    }));
  }

  return success(context);
}
