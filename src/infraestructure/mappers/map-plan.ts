import { Plan } from "../../domain/entities/plan";
import { PlanReview } from "../../domain/entities/plan-review";

export function mapPlanToResponse(plan: Plan) {
  return {
    ...mapPlanFields(plan),
    goals: plan.goals.map((goal) => ({
      id: goal.id.value,
      order: goal.order,
      description: goal.description,
      successCriterion: goal.successCriterion,
      status: goal.status,
      achievedAt: goal.achievedAt,
      updatedAt: goal.updatedAt,
    })),
  };
}

export function mapPlanToSummary(plan: Plan, studentName: string) {
  return {
    ...mapPlanFields(plan),
    studentName,
  };
}

export function mapPlanReviewToResponse(review: PlanReview) {
  return {
    id: review.id.value,
    planId: review.planId.value,
    reviewedAt: review.reviewedAt,
    note: review.note,
    nextReviewDate: review.nextReviewDate,
    goalStatuses: review.goalStatuses.map((goalStatus) => ({
      goalId: goalStatus.goalId.value,
      status: goalStatus.status,
    })),
  };
}

function mapPlanFields(plan: Plan) {
  return {
    id: plan.id.value,
    educatorId: plan.educatorId.value,
    studentId: plan.studentId.value,
    type: plan.type,
    status: plan.status,
    source: plan.source,
    title: plan.title,
    generalObjective: plan.generalObjective,
    professionalNotes: plan.professionalNotes,
    focus: plan.focus,
    consideredDifficulties: plan.consideredDifficulties,
    startDate: plan.startDate,
    endDate: plan.endDate,
    nextReviewDate: plan.nextReviewDate,
    parentPlanId: plan.parentPlanId?.value,
    sessionDate: plan.sessionDate,
    appointmentId: plan.appointmentId?.value,
    progress: plan.progress,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    closedAt: plan.closedAt,
  };
}
