import { success } from "@wave-telecom/framework/core";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";

export class ListScaleTemplatesUseCase {
  constructor(private templateRepository: ScaleTemplateRepository) {}

  // Catálogo visível a todos os educadores (AV-01).
  async execute() {
    return success(await this.templateRepository.listCatalog());
  }
}
