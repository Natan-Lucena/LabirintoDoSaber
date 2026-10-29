import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { isValidDateOnly } from "../utils/date-only";
import { GoalStatus, Plan } from "./plan";

export enum SuggestionKind {
  UPDATE_GOAL_STATUS = "UPDATE_GOAL_STATUS",
  ADD_GOAL = "ADD_GOAL",
  REWRITE_GOAL = "REWRITE_GOAL",
  SCHEDULE_REVIEW = "SCHEDULE_REVIEW",
}

export enum SuggestionStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  DISMISSED = "DISMISSED",
}

export const SUGGESTION_TEXT_MAX = 500;

export interface PlanSuggestionChange {
  status?: GoalStatus;
  description?: string;
  successCriterion?: string;
  nextReviewDate?: string;
}

export interface PlanSuggestionProps {
  id: Uuid;
  planId: Uuid;
  educatorId: Uuid;
  studentId: Uuid;
  goalId?: Uuid;
  kind: SuggestionKind;
  text: string;
  proposedChange: PlanSuggestionChange;
  status: SuggestionStatus;
  createdAt: Date;
  resolvedAt?: Date;
}

// Entrada crua (normalmente vinda do modelo): os campos são validados contra o plano.
export interface CreatePlanSuggestionProps {
  kind: string;
  goalId?: string;
  text: string;
  proposedChange?: Omit<PlanSuggestionChange, "status"> & { status?: string };
}

export type PlanSuggestionError = "INVALID_SUGGESTION" | "SUGGESTION_ALREADY_RESOLVED";

const isKind = (value: string): value is SuggestionKind =>
  Object.values(SuggestionKind).includes(value as SuggestionKind);

const isGoalStatus = (value: unknown): value is GoalStatus =>
  Object.values(GoalStatus).includes(value as GoalStatus);

const cleanText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export class PlanSuggestion {
  private constructor(private readonly props: PlanSuggestionProps) {}

  // Nasce PENDING. Recusa kind desconhecido, meta inexistente no plano,
  // mudança incoerente com o kind ou sem efeito, texto acima de 500 e revisão
  // fora da vigência.
  static create(plan: Plan, input: CreatePlanSuggestionProps) {
    const invalid = failure<PlanSuggestionError>("INVALID_SUGGESTION");

    const text = cleanText(input.text);
    if (!text || text.length > SUGGESTION_TEXT_MAX) return invalid;
    if (!isKind(input.kind)) return invalid;

    const change = input.proposedChange ?? {};
    const description = cleanText(change.description);
    const successCriterion = cleanText(change.successCriterion) || undefined;
    if (
      description.length > SUGGESTION_TEXT_MAX ||
      (successCriterion?.length ?? 0) > SUGGESTION_TEXT_MAX
    ) {
      return invalid;
    }

    const needsGoal =
      input.kind === SuggestionKind.UPDATE_GOAL_STATUS ||
      input.kind === SuggestionKind.REWRITE_GOAL;
    const goal = needsGoal
      ? plan.goals.find((g) => g.id.value === input.goalId)
      : undefined;
    if (needsGoal && !goal) return invalid;

    // Guarda só os campos que fazem sentido para o kind.
    let proposedChange: PlanSuggestionChange;
    switch (input.kind) {
      case SuggestionKind.UPDATE_GOAL_STATUS:
        // Sem efeito: a meta já está nesse status.
        if (!isGoalStatus(change.status) || change.status === goal?.status) {
          return invalid;
        }
        proposedChange = { status: change.status };
        break;
      case SuggestionKind.ADD_GOAL:
      case SuggestionKind.REWRITE_GOAL:
        if (!description) return invalid;
        proposedChange = { description, successCriterion };
        break;
      case SuggestionKind.SCHEDULE_REVIEW: {
        const date = change.nextReviewDate;
        if (
          typeof date !== "string" ||
          !isValidDateOnly(date) ||
          date < plan.startDate ||
          date > plan.endDate ||
          // Sem efeito: a revisão já está marcada para essa data.
          date === plan.nextReviewDate
        ) {
          return invalid;
        }
        proposedChange = { nextReviewDate: date };
        break;
      }
    }

    return success(
      new PlanSuggestion({
        id: Uuid.random(),
        planId: plan.id,
        educatorId: plan.educatorId,
        studentId: plan.studentId,
        goalId: goal?.id,
        kind: input.kind,
        text,
        proposedChange,
        status: SuggestionStatus.PENDING,
        createdAt: new Date(),
      })
    );
  }

  static fromPersistence(props: PlanSuggestionProps): PlanSuggestion {
    return new PlanSuggestion(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get planId(): Uuid {
    return this.props.planId;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get studentId(): Uuid {
    return this.props.studentId;
  }

  get goalId(): Uuid | undefined {
    return this.props.goalId;
  }

  get kind(): SuggestionKind {
    return this.props.kind;
  }

  get text(): string {
    return this.props.text;
  }

  get proposedChange(): PlanSuggestionChange {
    return this.props.proposedChange;
  }

  get status(): SuggestionStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get resolvedAt(): Date | undefined {
    return this.props.resolvedAt;
  }

  get isPending(): boolean {
    return this.props.status === SuggestionStatus.PENDING;
  }

  accept() {
    return this.resolve(SuggestionStatus.ACCEPTED);
  }

  dismiss() {
    return this.resolve(SuggestionStatus.DISMISSED);
  }

  private resolve(status: SuggestionStatus.ACCEPTED | SuggestionStatus.DISMISSED) {
    if (!this.isPending) {
      return failure<PlanSuggestionError>("SUGGESTION_ALREADY_RESOLVED");
    }

    return success(
      new PlanSuggestion({ ...this.props, status, resolvedAt: new Date() })
    );
  }
}
