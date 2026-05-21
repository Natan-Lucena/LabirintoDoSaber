import { Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplate } from "../entities/anamnese-template";

export interface AnamneseTemplateRepository {
  save(template: AnamneseTemplate): Promise<void>;
  findById(id: Uuid): Promise<AnamneseTemplate | null>;
  listByEducatorId(educatorId: Uuid): Promise<AnamneseTemplate[]>;
  deleteById(id: Uuid): Promise<void>;
}
