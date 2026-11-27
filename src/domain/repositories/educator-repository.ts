import { Educator } from "../entities/educator";
import { Uuid } from "@wave-telecom/framework/core";

export interface SearchEducatorProps {
  id?: Uuid;
  email?: string;
  name?: string;
  contact?: string;
}

export interface EducatorRepository {
  save(educator: Educator): Promise<Educator>;
  search(props: SearchEducatorProps): Promise<Educator[] | null>;
  getByEmail(email: string): Promise<Educator | null>;
  // Uma consulta para vários educadores; os inexistentes ficam de fora.
  getByIds(ids: Uuid[]): Promise<Educator[]>;
  delete(id: Uuid): Promise<void>;
}
