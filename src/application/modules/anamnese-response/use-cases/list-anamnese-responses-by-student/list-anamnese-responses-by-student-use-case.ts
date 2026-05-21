import { success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";

interface ListAnamneseResponsesByStudentUseCaseRequest {
  studentId: string;
}

export class ListAnamneseResponsesByStudentUseCase {
  constructor(private responseRepository: AnamneseResponseRepository) {}

  async execute(request: ListAnamneseResponsesByStudentUseCaseRequest) {
    const responses = await this.responseRepository.listByStudentId(
      new Uuid(request.studentId)
    );
    return success(responses);
  }
}
