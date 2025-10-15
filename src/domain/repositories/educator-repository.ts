import { Educator } from "../entities/educator";
import { Uuid } from "@wave-telecom/framework/core";

interface SearchEducatorProps {
  id?: Uuid;
  email?: string;
  name?: string;
}

export interface EducatorRepository {
  save(educator: Educator): Promise<Educator>;
  search(props: SearchEducatorProps): Promise<Educator[] | null>;
  getByEmail(email: string): Promise<Educator | null>;
  delete(id: Uuid): Promise<void>;
}
