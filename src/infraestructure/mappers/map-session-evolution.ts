import {
  CriterionResult,
  SessionEvolution,
} from "../../domain/entities/session-evolution";

const EXCERPT_LENGTH = 200;

export function mapSessionEvolutionToResponse(evolution: SessionEvolution) {
  return {
    id: evolution.id.value,
    sessionId: evolution.sessionId.value,
    studentId: evolution.studentId.value,
    educatorId: evolution.educatorId.value,
    appointmentId: evolution.appointmentId?.value,
    planId: evolution.planId?.value,
    planType: evolution.planType,
    planTitle: evolution.planTitle,
    sessionDate: evolution.sessionDate,
    durationMinutes: evolution.durationMinutes,
    criteria: evolution.criteria.map((criterion) => ({
      id: criterion.id.value,
      goalId: criterion.goalId?.value,
      description: criterion.description,
      successCriterion: criterion.successCriterion,
      attempts: criterion.attempts,
      successes: criterion.successes,
      result: criterion.result,
      note: criterion.note,
    })),
    descriptiveRecord: evolution.descriptiveRecord,
    nextSessionSuggestion: evolution.nextSessionSuggestion,
    goalUpdates: evolution.goalUpdates.map((update) => ({
      goalId: update.goalId,
      status: update.status,
    })),
    createdAt: evolution.createdAt,
    updatedAt: evolution.updatedAt,
  };
}

export function mapSessionEvolutionToSummary(
  evolution: SessionEvolution,
  studentName: string
) {
  return {
    id: evolution.id.value,
    sessionId: evolution.sessionId.value,
    studentId: evolution.studentId.value,
    studentName,
    sessionDate: evolution.sessionDate,
    planTitle: evolution.planTitle,
    criteriaCount: evolution.criteria.length,
    achievedCount: evolution.criteria.filter(
      (criterion) => criterion.result === CriterionResult.ACHIEVED
    ).length,
    excerpt: evolution.descriptiveRecord.slice(0, EXCERPT_LENGTH),
    createdAt: evolution.createdAt,
  };
}
