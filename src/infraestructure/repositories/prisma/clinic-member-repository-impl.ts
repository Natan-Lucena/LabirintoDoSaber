import { ClinicMember as PrismaClinicMember, Prisma, PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { ClinicMember } from "../../../domain/entities/clinic-member";
import {
  ClinicMemberAlreadyExistsError,
  ClinicMemberRepository,
} from "../../../domain/repositories/clinic-member-repository";

export class ClinicMemberRepositoryImpl implements ClinicMemberRepository {
  constructor(private prismaService: PrismaClient) {}

  async create(member: ClinicMember): Promise<void> {
    try {
      await this.prismaService.clinicMember.create({
        data: {
          id: member.id.value,
          clinicId: member.clinicId.value,
          educatorId: member.educatorId.value,
          role: member.role,
          joinedAt: member.joinedAt,
        },
      });
    } catch (error) {
      // P2002: violação de unicidade; aqui só existe a de educatorId.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ClinicMemberAlreadyExistsError();
      }
      throw error;
    }
  }

  async save(member: ClinicMember): Promise<void> {
    await this.prismaService.clinicMember.update({
      where: { id: member.id.value },
      data: { role: member.role },
    });
  }

  async findByEducatorId(educatorId: Uuid): Promise<ClinicMember | null> {
    const record = await this.prismaService.clinicMember.findUnique({
      where: { educatorId: educatorId.value },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async listByClinicId(clinicId: Uuid): Promise<ClinicMember[]> {
    const records = await this.prismaService.clinicMember.findMany({
      where: { clinicId: clinicId.value },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async deleteByEducatorId(educatorId: Uuid): Promise<void> {
    await this.prismaService.clinicMember.deleteMany({
      where: { educatorId: educatorId.value },
    });
  }

  private mapToEntity(record: PrismaClinicMember): ClinicMember {
    return ClinicMember.fromPersistence({
      id: new Uuid(record.id),
      clinicId: new Uuid(record.clinicId),
      educatorId: new Uuid(record.educatorId),
      role: record.role,
      joinedAt: record.joinedAt,
    });
  }
}
