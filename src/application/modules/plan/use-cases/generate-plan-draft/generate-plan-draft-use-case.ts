import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Plan, PlanType } from "../../../../../domain/entities/plan";
import { AnamneseTemplate } from "../../../../../domain/entities/anamnese-template";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import {
  AiInvalidOutputError,
  AiPlanGeneratorService,
  PlanAiGoal,
  PlanDraftOutput,
} from "../../../../../domain/services/ai-plan-generator-service";
import { addMonths, todayInSaoPaulo } from "../../../../../domain/utils/date-only";
import { AnamneseContextBuilder } from "../../../../services/anamnese-context-builder";
import { GenerateStudentAnalysisUseCase } from "../../../task-notebook-session/use-cases/generate-student-analisys/generate-student-analisys-use-case";
import { assertStudentOwnership, loadOwnedPlan } from "../plan-access";
import { buildPlanAiContext } from "../plan-ai-context";

const MIN_DRAFT_GOALS = 3;
const MAX_DRAFT_GOALS = 6;
const TITLE_MAX = 120;
const OBJECTIVE_MAX = 2000;
const RATIONALE_MAX = 1000;
const GOAL_TEXT_MAX = 500;

const NO_HISTORY_RATIONALE =
  "Plano gerado sem histórico de sessões, a partir do foco, das dificuldades consideradas e da anamnese, quando informada.";

export interface GeneratePlanDraftUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
  type: PlanType;
  focus: string;
  consideredDifficulties: string[];
  durationMonths?: number;
  parentPlanId?: string;
  sessionDate?: string;
  includeAnamnesisTemplateId?: string;
}

export interface PlanDraft {
  type: PlanType;
  title: string;
  generalObjective: string;
  goals: PlanAiGoal[];
  suggestedStartDate: string;
  suggestedEndDate: string;
  suggestedNextReviewDate?: string;
  rationale?: string;
}

const clip = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export class GeneratePlanDraftUseCase {
  constructor(
    private planRepository: PlanRepository,
    private studentRepository: StudentRepository,
    private anamneseTemplateRepository: AnamneseTemplateRepository,
    private anamneseBuilder: AnamneseContextBuilder,
    private analysisUseCase: GenerateStudentAnalysisUseCase,
    private aiPlanGenerator: AiPlanGeneratorService
  ) {}

  async execute(request: GeneratePlanDraftUseCaseRequest) {
    const ownership = await assertStudentOwnership(
      this.studentRepository,
      new Uuid(request.studentId),
      request.educatorId
    );
    if (!ownership.ok) return failure(ownership.error);
    const student = ownership.value;

    let parentPlan: Plan | undefined;
    if (request.type === PlanType.PE && request.parentPlanId) {
      const loaded = await loadOwnedPlan(
        this.planRepository,
        this.studentRepository,
        request.parentPlanId,
        request.educatorId
      );
      if (!loaded.ok) return failure(loaded.error);

      if (
        loaded.value.type !== PlanType.PDI ||
        loaded.value.studentId.value !== student.id.value
      ) {
        return failure("INVALID_PARENT_PLAN");
      }
      parentPlan = loaded.value;
    }

    let template: AnamneseTemplate | undefined;
    if (request.includeAnamnesisTemplateId) {
      const found = await this.anamneseTemplateRepository.findById(
        new Uuid(request.includeAnamnesisTemplateId)
      );
      if (!found || found.educatorId.value !== request.educatorId.value) {
        return failure("TEMPLATE_NOT_FOUND");
      }
      template = found;
    }

    const contextResult = await buildPlanAiContext({
      student,
      focus: request.focus,
      consideredDifficulties: request.consideredDifficulties,
      analysisUseCase: this.analysisUseCase,
      anamneseBuilder: this.anamneseBuilder,
      template,
      parentPlan,
    });
    if (!contextResult.ok) return failure(contextResult.error);
    const context = contextResult.value;

    let output: PlanDraftOutput;
    try {
      output = await this.aiPlanGenerator.generateDraft({
        type: request.type,
        durationMonths:
          request.type === PlanType.PDI ? request.durationMonths : undefined,
        context,
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
      console.error("[generate-plan-draft] AI call failed", {
        code: code ?? name,
        status,
      });
      return failure("AI_GENERATION_FAILED");
    }

    const normalized = this.normalize(output);
    if (!normalized) return failure("AI_INVALID_OUTPUT");

    if (!context.hasSessionHistory && !normalized.rationale) {
      normalized.rationale = NO_HISTORY_RATIONALE;
    }

    return success<PlanDraft>({
      type: request.type,
      ...normalized,
      ...this.suggestDates(request),
    });
  }

  private normalize(output: PlanDraftOutput) {
    const title = clip(output?.title, TITLE_MAX);
    const generalObjective = clip(output?.generalObjective, OBJECTIVE_MAX);
    const rationale = clip(output?.rationale, RATIONALE_MAX) || undefined;

    const goals: PlanAiGoal[] = (Array.isArray(output?.goals) ? output.goals : [])
      .map((goal) => ({
        description: clip(goal?.description, GOAL_TEXT_MAX),
        successCriterion: clip(goal?.successCriterion, GOAL_TEXT_MAX) || undefined,
      }))
      .filter((goal) => goal.description.length > 0);

    if (
      !title ||
      !generalObjective ||
      goals.length < MIN_DRAFT_GOALS ||
      goals.length > MAX_DRAFT_GOALS
    ) {
      return null;
    }

    return { title, generalObjective, goals, rationale };
  }

  // As datas são sempre do servidor, nunca do modelo.
  private suggestDates(request: GeneratePlanDraftUseCaseRequest) {
    if (request.type === PlanType.PE) {
      const sessionDate = request.sessionDate as string;
      return { suggestedStartDate: sessionDate, suggestedEndDate: sessionDate };
    }

    const start = todayInSaoPaulo();
    return {
      suggestedStartDate: start,
      suggestedEndDate: addMonths(start, request.durationMonths as number),
      suggestedNextReviewDate: addMonths(start, 1),
    };
  }
}
