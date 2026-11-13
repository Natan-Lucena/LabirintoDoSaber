import { Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponse, AnamneseSummary } from "../entities/anamnese-response";

export interface AnamneseResponseRepository {
  save(response: AnamneseResponse): Promise<void>;
  // Grava só a síntese, sem regravar as respostas lidas antes da IA.
  // Devolve false se a resposta não existe mais.
  saveSummary(id: Uuid, summary: AnamneseSummary): Promise<boolean>;
  findById(id: Uuid): Promise<AnamneseResponse | null>;
  listByStudentId(studentId: Uuid): Promise<AnamneseResponse[]>;
  existsByTemplateId(templateId: Uuid): Promise<boolean>;
}
