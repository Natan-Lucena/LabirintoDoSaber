import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { PlanRepository } from "../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../domain/repositories/student-repository";
import { PlanSuggestionRepository } from "../../../../domain/repositories/plan-suggestion-repository";

export async function assertStudentOwnership(
  studentRepository: StudentRepository,
  studentId: Uuid,
  educatorId: Uuid
) {
  const student = await studentRepository.getById(studentId);
  if (!student) return failure("STUDENT_NOT_FOUND");

  if (student.educatorId.value !== educatorId.value) {
    return failure("UNAUTHORIZED");
  }

  return success(student);
}

// Confere também o dono atual do aluno: se o aluno trocar de dono, o plano
// some para o educador antigo.
export async function loadOwnedPlan(
  planRepository: PlanRepository,
  studentRepository: StudentRepository,
  planId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(planId)) return failure("PLAN_NOT_FOUND");

  const plan = await planRepository.findById(new Uuid(planId));
  if (!plan) return failure("PLAN_NOT_FOUND");

  if (plan.educatorId.value !== educatorId.value) {
    return failure("UNAUTHORIZED");
  }

  const student = await studentRepository.getById(plan.studentId);
  if (!student || student.educatorId.value !== educatorId.value) {
    return failure("UNAUTHORIZED");
  }

  return success(plan);
}

// Sugestão do educador ainda pendente; base de aceitar e descartar.
export async function loadPendingSuggestion(
  suggestionRepository: PlanSuggestionRepository,
  suggestionId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(suggestionId)) return failure("SUGGESTION_NOT_FOUND");

  const suggestion = await suggestionRepository.findById(new Uuid(suggestionId));
  if (!suggestion) return failure("SUGGESTION_NOT_FOUND");

  if (suggestion.educatorId.value !== educatorId.value) {
    return failure("UNAUTHORIZED");
  }

  if (!suggestion.isPending) return failure("SUGGESTION_ALREADY_RESOLVED");

  return success(suggestion);
}
