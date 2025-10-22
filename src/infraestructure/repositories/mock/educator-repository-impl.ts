import { Uuid } from "@wave-telecom/framework/core";
import { Educator } from "../../../domain/entities/educator";
import {
  EducatorRepository,
  SearchEducatorProps,
} from "../../../domain/repositories/educator-repository";

export class MockEducatorRepository implements EducatorRepository {
  private data: Educator[] = [];

  async getByEmail(email: string): Promise<Educator | null> {
    const educator = this.data.find((educator) => educator.email === email);
    return educator ? Educator.create({
      id: educator.id,
      name: educator.name,
      email: educator.email,
      password: educator.password,
      createdAt: educator.createdAt
    }) : null;
  }

  async save(educator: Educator): Promise<Educator> {
    this.data.push(educator);
    return educator;
  }

  async search(props: SearchEducatorProps): Promise<Educator[] | null> {
    const results = this.data.filter((educator) => {
      if (props.id && educator.id !== props.id) return false;
      if (props.email && educator.email !== props.email) return false;
      if (props.name && educator.name !== props.name) return false;
      return true;
    });
    return results.length > 0 ? results : null;
  }

  async delete(id: Uuid): Promise<void> {
    this.data = this.data.filter((educator) => educator.id !== id);
  }
}
