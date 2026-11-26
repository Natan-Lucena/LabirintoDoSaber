import { success, Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAuthorNames } from "../../../../services/author-names";
import { loadAccessibleEvolution } from "../evolution-access";

export interface GetSessionEvolutionUseCaseRequest {
  educatorId: Uuid;
  evolutionId: string;
}

export class GetSessionEvolutionUseCase {
  constructor(
    private evolutionRepository: SessionEvolutionRepository,
    private studentAccess: StudentAccessService,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: GetSessionEvolutionUseCaseRequest) {
    const access = await loadAccessibleEvolution(
      this.evolutionRepository,
      this.studentAccess,
      request.evolutionId,
      request.educatorId
    );
    if (!access.ok) return access;
    const evolution = access.value;

    // EQ-12: authorName só quando o autor não é quem lê.
    const authorNames = await loadAuthorNames(
      this.educatorRepository,
      [evolution.educatorId],
      request.educatorId
    );

    return success({
      evolution,
      authorName: authorNames.get(evolution.educatorId.value),
    });
  }
}
