import { Uuid } from "@wave-telecom/framework/core";
import { Educator } from "../../../domain/entities/educator";
import {
  EducatorRepository,
  SearchEducatorProps,
} from "../../../domain/repositories/educator-repository";
import { Educator as PrismaEducator, PrismaClient } from "@prisma/client";

export class EducatorRepositoryImpl implements EducatorRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(educator: Educator): Promise<Educator> {
    const result = await this.prismaService.educator.upsert({
      where: { id: educator.id.value },
      create: {
        id: educator.id.value,
        name: educator.name,
        email: educator.email,
        password: educator.password,
        createdAt: educator.createdAt,
        photoUrl: educator.photoUrl,
        contact: educator.contact,
        profession: educator.profession ?? null,
      },
      update: {
        name: educator.name,
        email: educator.email,
        password: educator.password,
        photoUrl: educator.photoUrl,
        contact: educator.contact,
        profession: educator.profession ?? null,
      },
    });
    return this.mapToEntity(result);
  }
  async search(props: SearchEducatorProps): Promise<Educator[] | null> {
    const where = {
      id: props.id ? props.id.value : undefined,
      email: props.email,
      name: props.name,
      contact: props.contact,
    };
    const prismaEducators = await this.prismaService.educator.findMany({
      where,
    });
    return prismaEducators.map((educator) => this.mapToEntity(educator));
  }
  async getByEmail(email: string): Promise<Educator | null> {
    const result = await this.prismaService.educator.findFirst({
      where: { email },
    });
    return result ? this.mapToEntity(result) : null;
  }
  async delete(id: Uuid): Promise<void> {
    await this.prismaService.educator.delete({ where: { id: id.value } });
  }

  private mapToEntity(prismaEducator: PrismaEducator): Educator {
    return Educator.create({
      id: new Uuid(prismaEducator.id),
      name: prismaEducator.name,
      email: prismaEducator.email,
      password: prismaEducator.password,
      createdAt: prismaEducator.createdAt,
      photoUrl: prismaEducator.photoUrl ?? undefined,
      contact: prismaEducator.contact ?? undefined,
      profession: prismaEducator.profession ?? undefined,
    });
  }
}
