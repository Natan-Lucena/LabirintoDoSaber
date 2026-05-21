import { Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponse } from "../entities/anamnese-response";

export interface AnamneseResponseRepository {
  save(response: AnamneseResponse): Promise<void>;
  findById(id: Uuid): Promise<AnamneseResponse | null>;
  listByStudentId(studentId: Uuid): Promise<AnamneseResponse[]>;
  existsByTemplateId(templateId: Uuid): Promise<boolean>;
}
