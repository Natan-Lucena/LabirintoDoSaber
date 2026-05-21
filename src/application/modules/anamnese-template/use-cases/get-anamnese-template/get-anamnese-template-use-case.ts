import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";

interface GetAnamneseTemplateUseCaseRequest {
  templateId: string;
  educatorId: Uuid;
}

export class GetAnamneseTemplateUseCase {
  constructor(private templateRepository: AnamneseTemplateRepository) {}

  async execute(request: GetAnamneseTemplateUseCaseRequest) {
    const template = await this.templateRepository.findById(
      new Uuid(request.templateId)
    );

    if (!template) {
      return failure("TEMPLATE_NOT_FOUND");
    }

    if (template.educatorId.value !== request.educatorId.value) {
      return failure("UNAUTHORIZED");
    }

    return success(template);
  }
}
