import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { dateInSaoPaulo } from "../utils/date-only";
import { GoalStatus, Plan, PlanType } from "./plan";
import { TaskNotebookSession } from "./task-notebook-session";

export enum CriterionResult {
  ACHIEVED = "ACHIEVED",
  PARTIAL = "PARTIAL",
  NOT_ACHIEVED = "NOT_ACHIEVED",
  NOT_OBSERVED = "NOT_OBSERVED",
}

export const MAX_EVOLUTION_CRITERIA = 20;
export const MAX_CRITERION_ATTEMPTS = 100;

export interface EvolutionCriterion {
  id: Uuid;
  goalId?: Uuid;
  description: string;
  successCriterion?: string;
  attempts?: number;
  successes?: number;
  result: CriterionResult;
  note?: string;
}

export interface EvolutionCriterionInput {
  goalId?: string;
  description: string;
  successCriterion?: string;
  attempts?: number;
  successes?: number;
  result: CriterionResult;
  note?: string;
}

export interface EvolutionGoalUpdate {
  goalId: string;
  status: GoalStatus;
}

export interface SessionEvolutionProps {
  id: Uuid;
  sessionId: Uuid;
  studentId: Uuid;
  educatorId: Uuid;
  appointmentId?: Uuid;
  planId?: Uuid;
  planType?: PlanType;
  planTitle?: string;
  sessionDate: string;
  durationMinutes?: number;
  criteria: EvolutionCriterion[];
  descriptiveRecord: string;
  nextSessionSuggestion?: string;
  goalUpdates: EvolutionGoalUpdate[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionEvolutionProps {
  session: TaskNotebookSession;
  educatorId: Uuid;
  plan?: Plan;
  criteria: EvolutionCriterionInput[];
  descriptiveRecord: string;
  nextSessionSuggestion?: string;
  goalUpdates?: EvolutionGoalUpdate[];
}

export interface UpdateSessionEvolutionProps {
  criteria?: EvolutionCriterionInput[];
  descriptiveRecord?: string;
  nextSessionSuggestion?: string;
  goalUpdates?: EvolutionGoalUpdate[];
}

export type SessionEvolutionError =
  | "SESSION_NOT_FINISHED"
  | "TOO_MANY_CRITERIA"
  | "INVALID_ATTEMPTS"
  | "GOAL_NOT_IN_PLAN"
  | "INVALID_PLAN";

export class SessionEvolution {
  private constructor(private readonly props: SessionEvolutionProps) {}

  static create(props: CreateSessionEvolutionProps) {
    const { session, plan } = props;
    if (!session.finishedAt) {
      return failure<SessionEvolutionError>("SESSION_NOT_FINISHED");
    }

    const goalUpdates = props.goalUpdates ?? [];
    const error = SessionEvolution.validate(props.criteria, goalUpdates, plan);
    if (error) return failure(error);

    const now = new Date();

    return success(
      new SessionEvolution({
        id: Uuid.random(),
        sessionId: session.id,
        studentId: session.studentId,
        educatorId: props.educatorId,
        appointmentId: session.appointmentId,
        planId: plan?.id,
        planType: plan?.type,
        planTitle: plan?.title,
        sessionDate: dateInSaoPaulo(session.startedAt),
        durationMinutes: sessionDurationMinutes(session.startedAt, session.finishedAt),
        criteria: SessionEvolution.buildCriteria(props.criteria),
        descriptiveRecord: props.descriptiveRecord,
        nextSessionSuggestion: props.nextSessionSuggestion,
        goalUpdates,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  static fromPersistence(props: SessionEvolutionProps): SessionEvolution {
    return new SessionEvolution(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get sessionId(): Uuid {
    return this.props.sessionId;
  }

  get studentId(): Uuid {
    return this.props.studentId;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get appointmentId(): Uuid | undefined {
    return this.props.appointmentId;
  }

  get planId(): Uuid | undefined {
    return this.props.planId;
  }

  get planType(): PlanType | undefined {
    return this.props.planType;
  }

  get planTitle(): string | undefined {
    return this.props.planTitle;
  }

  get sessionDate(): string {
    return this.props.sessionDate;
  }

  get durationMinutes(): number | undefined {
    return this.props.durationMinutes;
  }

  get criteria(): EvolutionCriterion[] {
    return this.props.criteria;
  }

  get descriptiveRecord(): string {
    return this.props.descriptiveRecord;
  }

  get nextSessionSuggestion(): string | undefined {
    return this.props.nextSessionSuggestion;
  }

  get goalUpdates(): EvolutionGoalUpdate[] {
    return this.props.goalUpdates;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // `plan` é o plano gravado na evolução (planId), carregado pelo use case.
  update(props: UpdateSessionEvolutionProps, plan?: Plan) {
    const error = SessionEvolution.validate(
      props.criteria ?? [],
      props.goalUpdates ?? [],
      plan
    );
    if (error) return failure(error);

    return success(
      new SessionEvolution({
        ...this.props,
        criteria: props.criteria
          ? SessionEvolution.buildCriteria(props.criteria)
          : this.props.criteria,
        descriptiveRecord: props.descriptiveRecord ?? this.props.descriptiveRecord,
        nextSessionSuggestion:
          props.nextSessionSuggestion ?? this.props.nextSessionSuggestion,
        goalUpdates: props.goalUpdates ?? this.props.goalUpdates,
        updatedAt: new Date(),
      })
    );
  }

  private static validate(
    criteria: EvolutionCriterionInput[],
    goalUpdates: EvolutionGoalUpdate[],
    plan?: Plan
  ): SessionEvolutionError | null {
    if (criteria.length > MAX_EVOLUTION_CRITERIA) return "TOO_MANY_CRITERIA";

    const invalidAttempts = criteria.some((criterion) => {
      const { attempts, successes } = criterion;
      if (attempts !== undefined && (attempts < 0 || attempts > MAX_CRITERION_ATTEMPTS)) {
        return true;
      }
      if (successes === undefined) return false;
      return attempts === undefined || successes < 0 || successes > attempts;
    });
    if (invalidAttempts) return "INVALID_ATTEMPTS";

    if (goalUpdates.length > 0 && !plan) return "INVALID_PLAN";

    const planGoalIds = new Set(plan?.goals.map((goal) => goal.id.value) ?? []);
    const referencedGoalIds = [
      ...criteria.flatMap((criterion) => (criterion.goalId ? [criterion.goalId] : [])),
      ...goalUpdates.map((update) => update.goalId),
    ];
    if (referencedGoalIds.some((goalId) => !planGoalIds.has(goalId))) {
      return "GOAL_NOT_IN_PLAN";
    }

    return null;
  }

  private static buildCriteria(inputs: EvolutionCriterionInput[]): EvolutionCriterion[] {
    return inputs.map((input) => ({
      id: Uuid.random(),
      goalId: input.goalId ? new Uuid(input.goalId) : undefined,
      description: input.description,
      successCriterion: input.successCriterion,
      attempts: input.attempts,
      successes: input.successes,
      result: input.result,
      note: input.note,
    }));
  }
}

export function sessionDurationMinutes(startedAt: Date, finishedAt: Date): number {
  return Math.round((finishedAt.getTime() - startedAt.getTime()) / 60000);
}

// "Só a diferença" (EV-09): compara com o status atual do plano, não com os
// goalUpdates anteriores. Reaplicar a mesma lista não muda nada.
export function computeGoalChanges(
  plan: Plan,
  goalUpdates: EvolutionGoalUpdate[]
): EvolutionGoalUpdate[] {
  const statusById = new Map(plan.goals.map((goal) => [goal.id.value, goal.status]));

  return goalUpdates.filter((update) => {
    const current = statusById.get(update.goalId);
    return current !== undefined && current !== update.status;
  });
}
