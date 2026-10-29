import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";
import { mapPlanSuggestionToResponse } from "../../../../../infraestructure/mappers/map-plan";
import { assertStudentOwnership, loadPendingSuggestion } from "../plan-access";

export interface DismissPlanSuggestionUseCaseRequest {
  educatorId: Uuid;
  suggestionId: string;
}

export class DismissPlanSuggestionUseCase {
  constructor(
    private suggestionRepository: PlanSuggestionRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: DismissPlanSuggestionUseCaseRequest) {
    const loaded = await loadPendingSuggestion(
      this.suggestionRepository,
      request.suggestionId,
      request.educatorId
    );
    if (!loaded.ok) return failure(loaded.error);

    // Como no aceitar: confere também o dono atual do aluno.
    const ownership = await assertStudentOwnership(
      this.studentRepository,
      loaded.value.studentId,
      request.educatorId
    );
    if (!ownership.ok) return failure(ownership.error);

    const dismissed = loaded.value.dismiss();
    if (!dismissed.ok) return failure(dismissed.error);

    await this.suggestionRepository.save(dismissed.value);

    return success(
      mapPlanSuggestionToResponse(dismissed.value, ownership.value.name)
    );
  }
}
