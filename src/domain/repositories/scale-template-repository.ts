import { Uuid } from "@wave-telecom/framework/core";
import { ScaleTemplate } from "../entities/scale-template";

export interface ScaleTemplateRepository {
  // Upsert por id. Só o seed grava; versão publicada não muda.
  save(template: ScaleTemplate): Promise<void>;
  findById(id: Uuid): Promise<ScaleTemplate | null>;
  findByIds(ids: Uuid[]): Promise<ScaleTemplate[]>;
  findByCodeAndVersion(code: string, version: number): Promise<ScaleTemplate | null>;
  // Por code, só a maior versão, e só se ela estiver active. Ordenado por nome.
  listCatalog(): Promise<ScaleTemplate[]>;
}
