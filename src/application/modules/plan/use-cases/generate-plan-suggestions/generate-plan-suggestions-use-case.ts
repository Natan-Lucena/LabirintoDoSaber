import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { PlanStatus } from "../../../../../domain/entities/plan";
import { PlanSuggestion } from "../../../../../domain/entities/plan-suggestion";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";
import {
  AiInvalidOutputError,
  AiPlanGeneratorService,
  PlanSuggestionOutput,
} from "../../../../../domain/services/ai-plan-generator-service";
import { todayInSaoPaulo } from "../../../../../domain/utils/date-only";
import { mapPlanSuggestionToResponse } from "../../../../../infraestructure/mappers/map-plan";
import { AnamneseContextBuilder } from "../../../../services/anamnese-context-builder";
import { GenerateStudentAnalysisUseCase } from "../../../task-notebook-session/use-cases/generate-student-analisys/generate-student-analisys-use-case";
import { loadOwnedPlan } from "../plan-access";
import { buildPlanAiContext } from "../plan-ai-context";

export const MAX_PENDING_SUGGESTIONS = 3;

export interface GeneratePlanSuggestionsUseCaseRequest {
  educatorId: Uuid;
  planId: string;
}

export class GeneratePlanSuggestionsUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentRepository: StudentRepository,
    private suggestionRepository: PlanSuggestionRepository,
    private anamneseBuilder: AnamneseContextBuilder,
    private analysisUseCase: GenerateStudentAnalysisUseCase,
    private aiPlanGenerator: AiPlanGeneratorService
  ) {}

  async execute(request: GeneratePlanSuggestionsUseCaseRequest) {
    const planResult = await loadOwnedPlan(
      this.planRepository,
      this.studentRepository,
      request.planId,
      request.educatorId
    );
    if (!planResult.ok) return failure(planResult.error);
    const plan = planResult.value;

    if (plan.status !== PlanStatus.ACTIVE) return failure("PLAN_NOT_EDITABLE");

    const pending = await this.suggestionRepository.countPendingByPlanId(plan.id);
    if (pending >= MAX_PENDING_SUGGESTIONS) return success([]);
    const max = MAX_PENDING_SUGGESTIONS - pending;

    // loadOwnedPlan já conferiu que o aluno existe e é do educador.
    const student = (await this.studentRepository.getById(plan.studentId))!;

    const contextResult = await buildPlanAiContext({
      student,
      focus: plan.focus ?? "",
      consideredDifficulties: plan.consideredDifficulties,
      analysisUseCase: this.analysisUseCase,
      anamneseBuilder: this.anamneseBuilder,
    });
    if (!contextResult.ok) return failure(contextResult.error);

    let output: PlanSuggestionOutput[];
    try {
      output = await this.aiPlanGenerator.generateSuggestions({
        context: contextResult.value,
        plan: {
          type: plan.type,
          generalObjective: plan.generalObjective,
          startDate: plan.startDate,
          endDate: plan.endDate,
          nextReviewDate: plan.nextReviewDate,
          today: todayInSaoPaulo(),
          goals: plan.goals.map((goal) => ({
            id: goal.id.value,
            description: goal.description,
            successCriterion: goal.successCriterion,
            status: goal.status,
          })),
        },
        max,
      });
    } catch (err) {
      if (err instanceof AiInvalidOutputError) {
        return failure("AI_INVALID_OUTPUT");
      }
      // Só o código e o status: a mensagem do provedor pode ecoar o prompt.
      const { name, code, status } = (err ?? {}) as {
        name?: string;
        code?: string;
        status?: number;
      };
      console.error("[generate-plan-suggestions] AI call failed", {
        code: code ?? name,
        status,
      });
      return failure("AI_GENERATION_FAILED");
    }

    // Sugestões inválidas (kind desconhecido, meta inventada, mudança
    // incoerente, texto longo, data fora da vigência) são descartadas.
    const suggestions: PlanSuggestion[] = [];
    for (const item of Array.isArray(output) ? output : []) {
      const created = PlanSuggestion.create(plan, {
        kind: item?.kind,
        goalId: item?.goalId,
        text: item?.text,
        proposedChange: item?.proposedChange,
      });
      if (created.ok) suggestions.push(created.value);
    }

    const kept = suggestions.slice(0, max);
    for (const suggestion of kept) {
      await this.suggestionRepository.save(suggestion);
    }

    // Sem transação: duas gerações simultâneas podem passar do limite. Reconta
    // e descarta o excedente entre as que esta chamada acabou de criar.
    const pendingAfter = await this.suggestionRepository.countPendingByPlanId(plan.id);
    const excess = Math.min(
      Math.max(pendingAfter - MAX_PENDING_SUGGESTIONS, 0),
      kept.length
    );
    const returned = kept.slice(0, kept.length - excess);
    for (const suggestion of kept.slice(kept.length - excess)) {
      const dismissed = suggestion.dismiss();
      if (dismissed.ok) await this.suggestionRepository.save(dismissed.value);
    }

    return success(
      returned.map((suggestion) => mapPlanSuggestionToResponse(suggestion, student.name))
    );
  }
}
