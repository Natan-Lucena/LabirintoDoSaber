import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { PlanStatus } from "../../../../../domain/entities/plan";
import {
  CriterionResult,
  EvolutionCriterionInput,
  sessionDurationMinutes,
} from "../../../../../domain/entities/session-evolution";
import { dateInSaoPaulo } from "../../../../../domain/utils/date-only";
import { selectEvolutionPlan } from "../../../../../domain/services/evolution-plan-selector";
import {
  AiClinicalService,
  NextSessionSuggestionOutput,
  NextSessionSuggestionParams,
} from "../../../../../domain/services/ai-clinical-service";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { callClinicalAi, clipAiText } from "../../../../services/clinical-ai-call";
import { loadOwnedSession } from "../evolution-access";

const RECENT_EVOLUTIONS = 3;
const EXCERPT_LENGTH = 200;
const SUGGESTION_MAX = 1000;
const RATIONALE_MAX = 500;

export interface NextSessionSuggestionUseCaseRequest {
  educatorId: Uuid;
  sessionId: string;
  criteria?: EvolutionCriterionInput[];
  descriptiveRecord?: string;
}

// §3.6: sugestão para a próxima sessão. Não grava nada (BE-EV-08).
export class NextSessionSuggestionUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private studentRepository: StudentRepository,
    private planRepository: PlanRepository,
    private evolutionRepository: SessionEvolutionRepository,
    private aiClinicalService: AiClinicalService
  ) {}

  async execute(request: NextSessionSuggestionUseCaseRequest) {
    const access = await loadOwnedSession(
      this.sessionRepository,
      this.studentRepository,
      request.sessionId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { session, student } = access.value;

    const finishedAt = session.finishedAt;
    if (!finishedAt) return failure("SESSION_NOT_FINISHED");

    const [plans, evolutions] = await Promise.all([
      this.planRepository.search({
        educatorId: request.educatorId,
        studentId: session.studentId,
        status: PlanStatus.ACTIVE,
      }),
      // Só evoluções até a data desta sessão, e uma a mais, porque a
      // evolução desta mesma sessão (se houver) sai.
      this.evolutionRepository.search({
        studentIds: [student.id],
        to: dateInSaoPaulo(session.startedAt),
        limit: RECENT_EVOLUTIONS + 1,
      }),
    ]);
    const selection = selectEvolutionPlan({ session, plans });

    // Do plano vão só as metas: o título e o nome da sessão podem trazer o
    // nome da criança (IA-05).
    const params: NextSessionSuggestionParams = {
      student: { age: student.age, gender: student.gender },
      planGoals: selection?.suggestedCriteria.map((criterion) => ({
        description: criterion.description,
        successCriterion: criterion.successCriterion,
      })),
      session: {
        durationMinutes: sessionDurationMinutes(session.startedAt, finishedAt),
        answeredCount: session.answers.length,
        correctCount: session.answers.filter((answer) => answer.isCorrect).length,
      },
      criteria: (request.criteria ?? []).map((criterion) => ({
        description: criterion.description,
        successCriterion: criterion.successCriterion,
        attempts: criterion.attempts,
        successes: criterion.successes,
        result: criterion.result,
        note: criterion.note,
      })),
      descriptiveRecord: request.descriptiveRecord || undefined,
      recentEvolutions: evolutions
        .filter((evolution) => evolution.sessionId.value !== session.id.value)
        .slice(0, RECENT_EVOLUTIONS)
        .map((evolution) => ({
          sessionDate: evolution.sessionDate,
          achievedCount: evolution.criteria.filter(
            (criterion) => criterion.result === CriterionResult.ACHIEVED
          ).length,
          criteriaCount: evolution.criteria.length,
          excerpt: evolution.descriptiveRecord.slice(0, EXCERPT_LENGTH),
        })),
    };

    const output = await callClinicalAi("next-session-suggestion", () =>
      this.aiClinicalService.nextSessionSuggestion(params)
    );
    if (!output.ok) return output;

    const suggestion = clipAiText(output.value?.suggestion, SUGGESTION_MAX);
    if (!suggestion) return failure("AI_INVALID_OUTPUT");

    const rationale = clipAiText(output.value?.rationale, RATIONALE_MAX);

    return success<NextSessionSuggestionOutput>(
      rationale ? { suggestion, rationale } : { suggestion }
    );
  }
}
