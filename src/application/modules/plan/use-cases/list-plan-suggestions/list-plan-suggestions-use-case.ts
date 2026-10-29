import { success, Uuid } from "@wave-telecom/framework/core";
import { SuggestionStatus } from "../../../../../domain/entities/plan-suggestion";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { PlanSuggestionRepository } from "../../../../../domain/repositories/plan-suggestion-repository";
import { mapPlanSuggestionToResponse } from "../../../../../infraestructure/mappers/map-plan";

export interface ListPlanSuggestionsUseCaseRequest {
  educatorId: Uuid;
  status?: SuggestionStatus;
}

export class ListPlanSuggestionsUseCase {
  constructor(
    private suggestionRepository: PlanSuggestionRepository,
    private studentRepository: StudentRepository
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

    // Como nos planos: alunos que trocaram de dono somem para o educador antigo.
    const ownedStudents = new Map(
      students
        .filter((student) => student.educatorId.value === request.educatorId.value)
        .map((student) => [student.id.value, student])
    );

    return success(
      suggestions
        .filter((suggestion) => ownedStudents.has(suggestion.studentId.value))
        .map((suggestion) =>
          mapPlanSuggestionToResponse(
            suggestion,
            ownedStudents.get(suggestion.studentId.value)!.name
          )
        )
    );
  }
}
