import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";
import { mapPlanSuggestionToResponse } from "../../../../../infraestructure/mappers/map-plan";
import { loadPendingSuggestion } from "../plan-access";

export interface DismissPlanSuggestionUseCaseRequest {
  educatorId: Uuid;
  suggestionId: string;
}

export class DismissPlanSuggestionUseCase {
  constructor(
    private suggestionRepository: PlanSuggestionRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: DismissPlanSuggestionUseCaseRequest) {
    const loaded = await loadPendingSuggestion(
      this.suggestionRepository,
      request.suggestionId,
      request.educatorId
    );
    if (!loaded.ok) return failure(loaded.error);

    // Como no aceitar: confere também o acesso atual ao aluno (EQ-11).
    const access = await this.studentAccess.assertStudentAccess(
      loaded.value.studentId,
      request.educatorId
    );
    if (!access.ok) return failure(access.error);

    const dismissed = loaded.value.dismiss();
    if (!dismissed.ok) return failure(dismissed.error);

    await this.suggestionRepository.save(dismissed.value);

    return success(
      mapPlanSuggestionToResponse(dismissed.value, access.value.name)
    );
  }
}
