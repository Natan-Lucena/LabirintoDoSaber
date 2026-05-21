import { success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";

interface ListAnamneseTemplatesUseCaseRequest {
  educatorId: Uuid;
}

export class ListAnamneseTemplatesUseCase {
  constructor(private templateRepository: AnamneseTemplateRepository) {}

  async execute(request: ListAnamneseTemplatesUseCaseRequest) {
    const templates = await this.templateRepository.listByEducatorId(
      request.educatorId
    );
    return success(templates);
  }
}
