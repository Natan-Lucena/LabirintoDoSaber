import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import {
  AnamneseTemplate,
  AnamneseQuestionInput,
} from "../../../../../domain/entities/anamnese-template";

interface CreateAnamneseTemplateUseCaseRequest {
  educatorId: Uuid;
  title: string;
  description?: string;
  questions: AnamneseQuestionInput[];
}

export class CreateAnamneseTemplateUseCase {
  constructor(private templateRepository: AnamneseTemplateRepository) {}

  async execute(request: CreateAnamneseTemplateUseCaseRequest) {
    const template = AnamneseTemplate.create({
      educatorId: request.educatorId,
      title: request.title,
      description: request.description,
      questions: request.questions,
    });

    if (!template.ok) {
      return failure("TEMPLATE_CREATION_FAILED");
    }

    await this.templateRepository.save(template.value);
    return success(template.value);
  }
}
