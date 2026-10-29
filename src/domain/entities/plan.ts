import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { isValidDateOnly } from "../utils/date-only";
import { PlanReview } from "./plan-review";

export enum PlanType {
  PDI = "PDI",
  PE = "PE",
}

export enum PlanStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum GoalStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  ACHIEVED = "ACHIEVED",
  DISCONTINUED = "DISCONTINUED",
}

export enum PlanSource {
  AI = "AI",
  MANUAL = "MANUAL",
}

export const MAX_PLAN_GOALS = 10;

export interface PlanGoal {
  id: Uuid;
  order: number;
  description: string;
  successCriterion?: string;
  status: GoalStatus;
  achievedAt?: Date;
  updatedAt: Date;
}

export interface PlanGoalInput {
  description: string;
  successCriterion?: string;
}

export interface PlanGoalUpdateInput extends PlanGoalInput {
  id?: string;
}

export interface PlanProgress {
  totalGoals: number;
  achievedGoals: number;
  inProgressGoals: number;
  percent: number;
}

export interface PlanProps {
  id: Uuid;
  educatorId: Uuid;
  studentId: Uuid;
  type: PlanType;
  status: PlanStatus;
  source: PlanSource;
  title: string;
  generalObjective: string;
  professionalNotes?: string;
  focus?: string;
  consideredDifficulties: string[];
  startDate: string;
  endDate: string;
  nextReviewDate?: string;
  parentPlanId?: Uuid;
  sessionDate?: string;
  appointmentId?: Uuid;
  goals: PlanGoal[];
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}

export interface CreatePlanProps {
  educatorId: Uuid;
  studentId: Uuid;
  type: PlanType;
  source: PlanSource;
  title: string;
  generalObjective: string;
  professionalNotes?: string;
  focus?: string;
  consideredDifficulties?: string[];
  startDate?: string;
  endDate?: string;
  nextReviewDate?: string;
  parentPlanId?: Uuid;
  sessionDate?: string;
  appointmentId?: Uuid;
  goals: PlanGoalInput[];
}

export interface UpdatePlanProps {
  title?: string;
  generalObjective?: string;
  professionalNotes?: string;
  endDate?: string;
  nextReviewDate?: string;
  goals?: PlanGoalUpdateInput[];
}

export type PlanError =
  | "PLAN_WITHOUT_GOALS"
  | "TOO_MANY_GOALS"
  | "SESSION_DATE_REQUIRED"
  | "INVALID_FIELDS_FOR_PDI"
  | "INVALID_DATES"
  | "PLAN_NOT_EDITABLE"
  | "GOAL_NOT_FOUND"
  | "DUPLICATE_GOAL_ID"
  | "GOAL_ACHIEVED_CANNOT_BE_REMOVED";

export class Plan {
  private constructor(private readonly props: PlanProps) {}

  static create(props: CreatePlanProps) {
    const goalsCheck = Plan.validateGoalCount(props.goals.length);
    if (goalsCheck) return failure(goalsCheck);

    let startDate = props.startDate;
    let endDate = props.endDate;

    if (props.type === PlanType.PE) {
      if (!props.sessionDate) return failure<PlanError>("SESSION_DATE_REQUIRED");
      startDate = props.sessionDate;
      endDate = props.sessionDate;
    } else if (props.sessionDate || props.parentPlanId || props.appointmentId) {
      return failure<PlanError>("INVALID_FIELDS_FOR_PDI");
    }

    if (
      !startDate ||
      !endDate ||
      !Plan.datesAreValid(props.type, startDate, endDate, props.nextReviewDate)
    ) {
      return failure<PlanError>("INVALID_DATES");
    }

    const now = new Date();

    return success(
      new Plan({
        id: Uuid.random(),
        educatorId: props.educatorId,
        studentId: props.studentId,
        type: props.type,
        status: PlanStatus.ACTIVE,
        source: props.source,
        title: props.title,
        generalObjective: props.generalObjective,
        professionalNotes: props.professionalNotes,
        focus: props.focus,
        consideredDifficulties: props.consideredDifficulties ?? [],
        startDate,
        endDate,
        nextReviewDate: props.nextReviewDate,
        parentPlanId: props.parentPlanId,
        sessionDate: props.sessionDate,
        appointmentId: props.appointmentId,
        goals: props.goals.map((goal, index) => ({
          id: Uuid.random(),
          order: index,
          description: goal.description,
          successCriterion: goal.successCriterion,
          status: GoalStatus.NOT_STARTED,
          updatedAt: now,
        })),
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  static fromPersistence(props: PlanProps): Plan {
    return new Plan(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get studentId(): Uuid {
    return this.props.studentId;
  }

  get type(): PlanType {
    return this.props.type;
  }

  get status(): PlanStatus {
    return this.props.status;
  }

  get source(): PlanSource {
    return this.props.source;
  }

  get title(): string {
    return this.props.title;
  }

  get generalObjective(): string {
    return this.props.generalObjective;
  }

  get professionalNotes(): string | undefined {
    return this.props.professionalNotes;
  }

  get focus(): string | undefined {
    return this.props.focus;
  }

  get consideredDifficulties(): string[] {
    return this.props.consideredDifficulties;
  }

  get startDate(): string {
    return this.props.startDate;
  }

  get endDate(): string {
    return this.props.endDate;
  }

  get nextReviewDate(): string | undefined {
    return this.props.nextReviewDate;
  }

  get parentPlanId(): Uuid | undefined {
    return this.props.parentPlanId;
  }

  get sessionDate(): string | undefined {
    return this.props.sessionDate;
  }

  get appointmentId(): Uuid | undefined {
    return this.props.appointmentId;
  }

  get goals(): PlanGoal[] {
    return this.props.goals;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get closedAt(): Date | undefined {
    return this.props.closedAt;
  }

  get isEditable(): boolean {
    return this.props.status === PlanStatus.ACTIVE;
  }

  get progress(): PlanProgress {
    const counted = this.props.goals.filter(
      (goal) => goal.status !== GoalStatus.DISCONTINUED
    );
    const achievedGoals = counted.filter(
      (goal) => goal.status === GoalStatus.ACHIEVED
    ).length;
    const inProgressGoals = counted.filter(
      (goal) => goal.status === GoalStatus.IN_PROGRESS
    ).length;
    const totalGoals = counted.length;

    return {
      totalGoals,
      achievedGoals,
      inProgressGoals,
      percent:
        totalGoals === 0 ? 0 : Math.round((100 * achievedGoals) / totalGoals),
    };
  }

  update(props: UpdatePlanProps) {
    if (!this.isEditable) return failure<PlanError>("PLAN_NOT_EDITABLE");

    // No PE a vigência é a própria data da sessão; datesAreValid recusa
    // um endDate diferente dela.
    const endDate = props.endDate ?? this.props.endDate;
    const nextReviewDate = props.nextReviewDate ?? this.props.nextReviewDate;

    if (
      !Plan.datesAreValid(
        this.props.type,
        this.props.startDate,
        endDate,
        nextReviewDate
      )
    ) {
      return failure<PlanError>("INVALID_DATES");
    }

    const now = new Date();
    let goals = this.props.goals;

    if (props.goals) {
      const goalsResult = this.mergeGoals(props.goals, now);
      if (!goalsResult.ok) return goalsResult;
      goals = goalsResult.value;
    }

    return success(
      new Plan({
        ...this.props,
        title: props.title ?? this.props.title,
        generalObjective: props.generalObjective ?? this.props.generalObjective,
        professionalNotes: props.professionalNotes ?? this.props.professionalNotes,
        endDate,
        nextReviewDate,
        goals,
        updatedAt: now,
      })
    );
  }

  changeGoalStatus(goalId: string, status: GoalStatus) {
    if (!this.isEditable) return failure<PlanError>("PLAN_NOT_EDITABLE");

    const goal = this.props.goals.find((g) => g.id.value === goalId);
    if (!goal) return failure<PlanError>("GOAL_NOT_FOUND");

    const now = new Date();

    // Mantém a data original se a meta já estava atingida; limpa ao sair.
    let achievedAt: Date | undefined;
    if (status === GoalStatus.ACHIEVED) {
      achievedAt = goal.achievedAt ?? now;
    }

    return success(
      new Plan({
        ...this.props,
        goals: this.props.goals.map((g) =>
          g.id.value === goalId
            ? { ...g, status, achievedAt, updatedAt: now }
            : g
        ),
        updatedAt: now,
      })
    );
  }

  addGoal(input: PlanGoalInput) {
    if (!this.isEditable) return failure<PlanError>("PLAN_NOT_EDITABLE");

    const goalsCheck = Plan.validateGoalCount(this.props.goals.length + 1);
    if (goalsCheck) return failure(goalsCheck);

    const now = new Date();

    return success(
      new Plan({
        ...this.props,
        goals: [
          ...this.props.goals,
          {
            id: Uuid.random(),
            order: this.props.goals.length,
            description: input.description,
            successCriterion: input.successCriterion,
            status: GoalStatus.NOT_STARTED,
            updatedAt: now,
          },
        ],
        updatedAt: now,
      })
    );
  }

  close(status: PlanStatus.COMPLETED | PlanStatus.CANCELLED) {
    if (!this.isEditable) return failure<PlanError>("PLAN_NOT_EDITABLE");

    const now = new Date();

    return success(
      new Plan({
        ...this.props,
        status,
        closedAt: now,
        updatedAt: now,
      })
    );
  }

  review(note: string, nextReviewDate?: string) {
    if (!this.isEditable) return failure<PlanError>("PLAN_NOT_EDITABLE");

    const newNextReviewDate = nextReviewDate ?? this.props.nextReviewDate;

    if (
      !Plan.datesAreValid(
        this.props.type,
        this.props.startDate,
        this.props.endDate,
        newNextReviewDate
      )
    ) {
      return failure<PlanError>("INVALID_DATES");
    }

    const review = PlanReview.create({
      planId: this.props.id,
      educatorId: this.props.educatorId,
      note,
      nextReviewDate,
      goalStatuses: this.props.goals.map((goal) => ({
        goalId: goal.id,
        status: goal.status,
      })),
    });

    const plan = new Plan({
      ...this.props,
      nextReviewDate: newNextReviewDate,
      updatedAt: review.reviewedAt,
    });

    return success({ plan, review });
  }

  // Edição pela lista completa: com id atualiza, sem id cria, ausente remove.
  private mergeGoals(inputs: PlanGoalUpdateInput[], now: Date) {
    const goalsCheck = Plan.validateGoalCount(inputs.length);
    if (goalsCheck) return failure(goalsCheck);

    const currentById = new Map(this.props.goals.map((g) => [g.id.value, g]));

    if (inputs.some((input) => input.id && !currentById.has(input.id))) {
      return failure<PlanError>("GOAL_NOT_FOUND");
    }

    const inputIds = inputs.map((input) => input.id).filter(Boolean);
    const keptIds = new Set(inputIds);
    if (keptIds.size !== inputIds.length) {
      return failure<PlanError>("DUPLICATE_GOAL_ID");
    }

    const removesAchieved = this.props.goals.some(
      (goal) => goal.status === GoalStatus.ACHIEVED && !keptIds.has(goal.id.value)
    );
    if (removesAchieved) {
      return failure<PlanError>("GOAL_ACHIEVED_CANNOT_BE_REMOVED");
    }

    const goals: PlanGoal[] = inputs.map((input, index) => {
      const existing = input.id ? currentById.get(input.id) : undefined;

      if (existing) {
        return {
          ...existing,
          order: index,
          description: input.description,
          successCriterion: input.successCriterion,
          updatedAt: now,
        };
      }

      return {
        id: Uuid.random(),
        order: index,
        description: input.description,
        successCriterion: input.successCriterion,
        status: GoalStatus.NOT_STARTED,
        updatedAt: now,
      };
    });

    return success(goals);
  }

  private static validateGoalCount(count: number): PlanError | null {
    if (count === 0) return "PLAN_WITHOUT_GOALS";
    if (count > MAX_PLAN_GOALS) return "TOO_MANY_GOALS";
    return null;
  }

  private static datesAreValid(
    type: PlanType,
    startDate: string,
    endDate: string,
    nextReviewDate?: string
  ): boolean {
    if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate)) return false;

    if (type === PlanType.PDI && endDate <= startDate) return false;
    if (type === PlanType.PE && endDate !== startDate) return false;

    if (nextReviewDate !== undefined) {
      if (!isValidDateOnly(nextReviewDate)) return false;
      if (nextReviewDate < startDate || nextReviewDate > endDate) return false;
    }

    return true;
  }
}
