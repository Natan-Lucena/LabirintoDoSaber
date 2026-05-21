import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { AnamneseQuestionInput } from "../../../../../domain/entities/anamnese-template";

interface UpdateAnamneseTemplateUseCaseRequest {
  templateId: string;
  educatorId: Uuid;
  title?: string;
  description?: string;
  questions?: AnamneseQuestionInput[];
}

export class UpdateAnamneseTemplateUseCase {
  constructor(
    private templateRepository: AnamneseTemplateRepository,
    private responseRepository: AnamneseResponseRepository
  ) {}

  async execute(request: UpdateAnamneseTemplateUseCaseRequest) {
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

    const updated = template.update({
      title: request.title,
      description: request.description,
      questions: request.questions,
    });

    if (!updated.ok) {
      return failure("INVALID_TEMPLATE_DATA");
    }

    await this.templateRepository.save(updated.value);
    return success(updated.value);
  }
}
