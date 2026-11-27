import { Clinic as PrismaClinic, PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { Clinic } from "../../../domain/entities/clinic";
import { ClinicRepository } from "../../../domain/repositories/clinic-repository";

export class ClinicRepositoryImpl implements ClinicRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(clinic: Clinic): Promise<void> {
    await this.prismaService.clinic.upsert({
      where: { id: clinic.id.value },
      create: { id: clinic.id.value, name: clinic.name, createdAt: clinic.createdAt },
      update: { name: clinic.name },
    });
  }

  async findById(id: Uuid): Promise<Clinic | null> {
    const record = await this.prismaService.clinic.findUnique({ where: { id: id.value } });
    return record ? this.mapToEntity(record) : null;
  }

  async delete(id: Uuid): Promise<void> {
    await this.prismaService.clinic.deleteMany({ where: { id: id.value } });
  }

  private mapToEntity(record: PrismaClinic): Clinic {
    return Clinic.fromPersistence({
      id: new Uuid(record.id),
      name: record.name,
      createdAt: record.createdAt,
    });
  }
}
