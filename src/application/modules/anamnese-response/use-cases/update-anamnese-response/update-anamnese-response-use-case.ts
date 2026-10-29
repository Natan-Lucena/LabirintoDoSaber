import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { AnamneseAnswerInput } from "../../../../../domain/entities/anamnese-response";

interface UpdateAnamneseResponseUseCaseRequest {
  responseId: string;
  educatorId: Uuid;
  answers: AnamneseAnswerInput[];
}

export class UpdateAnamneseResponseUseCase {
  constructor(
    private templateRepository: AnamneseTemplateRepository,
    private responseRepository: AnamneseResponseRepository
  ) {}

  async execute(request: UpdateAnamneseResponseUseCaseRequest) {
    if (!Uuid.isValid(request.responseId)) {
      return failure("RESPONSE_NOT_FOUND");
    }

    const response = await this.responseRepository.findById(
      new Uuid(request.responseId)
    );
    if (!response) {
      return failure("RESPONSE_NOT_FOUND");
    }

    if (response.educatorId.value !== request.educatorId.value) {
      return failure("UNAUTHORIZED");
    }

    const template = await this.templateRepository.findById(response.templateId);
    if (!template) {
      return failure("TEMPLATE_NOT_FOUND");
    }

    const updated = response.updateAnswers(request.answers, template);
    if (!updated.ok) {
      return updated;
    }

    await this.responseRepository.save(updated.value);
    return success(updated.value);
  }
}
