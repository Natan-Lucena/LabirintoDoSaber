import { Uuid } from "@wave-telecom/framework/core";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { loadOwnedEvolution } from "../evolution-access";

export interface GetSessionEvolutionUseCaseRequest {
  educatorId: Uuid;
  evolutionId: string;
}

export class GetSessionEvolutionUseCase {
  constructor(
    private evolutionRepository: SessionEvolutionRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: GetSessionEvolutionUseCaseRequest) {
    return loadOwnedEvolution(
      this.evolutionRepository,
      this.studentRepository,
      request.evolutionId,
      request.educatorId
    );
  }
}
