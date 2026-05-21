import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";

interface DeleteAnamneseTemplateUseCaseRequest {
  templateId: string;
  educatorId: Uuid;
}

export class DeleteAnamneseTemplateUseCase {
  constructor(
    private templateRepository: AnamneseTemplateRepository,
    private responseRepository: AnamneseResponseRepository
  ) {}

  async execute(request: DeleteAnamneseTemplateUseCaseRequest) {
    const template = await this.templateRepository.findById(
      new Uuid(request.templateId)
    );

    if (!template) {
      return failure("TEMPLATE_NOT_FOUND");
    }

    if (template.educatorId.value !== request.educatorId.value) {
      return failure("UNAUTHORIZED");
    }

    const hasResponses = await this.responseRepository.existsByTemplateId(template.id);
    if (hasResponses) {
      return failure("TEMPLATE_HAS_RESPONSES");
    }

    await this.templateRepository.deleteById(template.id);
    return success(null);
  }
}
