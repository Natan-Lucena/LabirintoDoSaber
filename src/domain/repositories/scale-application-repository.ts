import { Uuid } from "@wave-telecom/framework/core";
import {
  ApplicationStatus,
  ScaleApplication,
} from "../entities/scale-application";

export interface SearchScaleApplicationParams {
  // Alunos cujo dono atual é o educador; o autor gravado na aplicação não entra.
  studentIds: Uuid[];
  status?: ApplicationStatus;
  limit: number;
}

export interface ScaleApplicationRepository {
  save(application: ScaleApplication): Promise<void>;
  findById(id: Uuid): Promise<ScaleApplication | null>;
  // O rascunho mais recente do aluno na escala (qualquer versão).
  findDraft(studentId: Uuid, templateCode: string): Promise<ScaleApplication | null>;
  // Ordenado por updatedAt, mais recente primeiro.
  search(params: SearchScaleApplicationParams): Promise<ScaleApplication[]>;
  delete(id: Uuid): Promise<void>;
}
