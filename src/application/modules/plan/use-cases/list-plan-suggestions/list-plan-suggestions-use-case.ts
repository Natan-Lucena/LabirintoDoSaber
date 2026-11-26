import { success, Uuid } from "@wave-telecom/framework/core";
import { SuggestionStatus } from "../../../../../domain/entities/plan-suggestion";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";
import { mapPlanSuggestionToResponse } from "../../../../../infraestructure/mappers/map-plan";

export interface ListPlanSuggestionsUseCaseRequest {
  educatorId: Uuid;
  status?: SuggestionStatus;
}

export class ListPlanSuggestionsUseCase {
  constructor(
    private suggestionRepository: PlanSuggestionRepository,
    private studentRepository: StudentRepository,
    private studentAccess: StudentAccessService
  ) {}

  // O repositório já devolve ordenado por createdAt desc.
  async execute(request: ListPlanSuggestionsUseCaseRequest) {
    const suggestions = await this.suggestionRepository.listByEducatorId(
      request.educatorId,
      request.status
    );

    const studentIds = [...new Set(suggestions.map((s) => s.studentId.value))];
    const students = await this.studentRepository.getByIds(
      studentIds.map((id) => new Uuid(id))
    );

    // Como nos planos: só alunos que o educador ainda acessa (dono ou
    // compartilhado); transferido ou descompartilhado some.
    const accessible = await this.studentAccess.filterAccessible(
      students,
      request.educatorId
    );
    const accessibleStudents = new Map(
      accessible.map((student) => [student.id.value, student])
    );

    return success(
      suggestions
        .filter((suggestion) => accessibleStudents.has(suggestion.studentId.value))
        .map((suggestion) =>
          mapPlanSuggestionToResponse(
            suggestion,
            accessibleStudents.get(suggestion.studentId.value)!.name
          )
        )
    );
  }
}
