import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { PlanRepository } from "../../../../domain/repositories/plan-repository";
import { PlanSuggestionRepository } from "../../../../domain/repositories/plan-suggestion-repository";
import { StudentAccessService } from "../../../../domain/services/student-access-service";

// Acesso pelo aluno do plano, dono ou compartilhado (EQ-11), não pelo autor
// gravado: se o aluno trocar de dono, o plano some para o educador antigo.
export async function loadAccessiblePlan(
  planRepository: PlanRepository,
  studentAccess: StudentAccessService,
  planId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(planId)) return failure("PLAN_NOT_FOUND");

  const plan = await planRepository.findById(new Uuid(planId));
  if (!plan) return failure("PLAN_NOT_FOUND");

  const access = await studentAccess.assertStudentAccess(plan.studentId, educatorId);
  // Aluno excluído também fecha o acesso ao plano.
  if (!access.ok) return failure("UNAUTHORIZED");

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
