import { Uuid } from "@wave-telecom/framework/core";
import type { GoalStatus } from "./plan";

export interface PlanReviewGoalStatus {
  goalId: Uuid;
  status: GoalStatus;
}

export interface PlanReviewProps {
  id: Uuid;
  planId: Uuid;
  educatorId: Uuid;
  reviewedAt: Date;
  note: string;
  nextReviewDate?: string;
  goalStatuses: PlanReviewGoalStatus[];
}

export class PlanReview {
  private constructor(private readonly props: PlanReviewProps) {}

  static create(props: Omit<PlanReviewProps, "id" | "reviewedAt">): PlanReview {
    return new PlanReview({
      ...props,
      id: Uuid.random(),
      reviewedAt: new Date(),
    });
  }

  static fromPersistence(props: PlanReviewProps): PlanReview {
    return new PlanReview(props);
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

  get reviewedAt(): Date {
    return this.props.reviewedAt;
  }

  get note(): string {
    return this.props.note;
  }

  get nextReviewDate(): string | undefined {
    return this.props.nextReviewDate;
  }

  get goalStatuses(): PlanReviewGoalStatus[] {
    return this.props.goalStatuses;
  }
}
