import { Uuid } from "@wave-telecom/framework/core";
import { Clinic } from "../entities/clinic";

export interface ClinicRepository {
  save(clinic: Clinic): Promise<void>;
  findById(id: Uuid): Promise<Clinic | null>;
  delete(id: Uuid): Promise<void>;
}
