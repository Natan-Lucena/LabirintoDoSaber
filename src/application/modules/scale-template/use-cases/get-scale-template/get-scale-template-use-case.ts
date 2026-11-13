import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";

export interface GetScaleTemplateUseCaseRequest {
  templateId: string;
}

export class GetScaleTemplateUseCase {
  constructor(private templateRepository: ScaleTemplateRepository) {}

  // Devolve também versões antigas ou inativas: aplicações gravadas as usam.
  async execute(request: GetScaleTemplateUseCaseRequest) {
    if (!Uuid.isValid(request.templateId)) return failure("SCALE_NOT_FOUND");

    const template = await this.templateRepository.findById(new Uuid(request.templateId));
    if (!template) return failure("SCALE_NOT_FOUND");

    return success(template);
  }
}
