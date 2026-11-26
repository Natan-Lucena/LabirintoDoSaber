import { ClinicInvite as PrismaClinicInvite, Prisma, PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { ClinicInvite } from "../../../domain/entities/clinic-invite";
import {
  ClinicInviteRepository,
  InviteCodeTakenError,
} from "../../../domain/repositories/clinic-invite-repository";

// Os opcionais são gravados como null: os filtros `usedAt: null` e
// `revokedAt: null` dependem disso.
const activeWhere = (clinicId: Uuid, now: Date) => ({
  clinicId: clinicId.value,
  usedAt: null,
  revokedAt: null,
  expiresAt: { gt: now },
});

export class ClinicInviteRepositoryImpl implements ClinicInviteRepository {
  constructor(private prismaService: PrismaClient) {}

  async create(invite: ClinicInvite): Promise<void> {
    try {
      await this.prismaService.clinicInvite.create({ data: this.toData(invite) });
    } catch (error) {
      // P2002: violação de unicidade; o id é sorteado, então é a de code.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new InviteCodeTakenError();
      }
      throw error;
    }
  }

  async findById(id: Uuid): Promise<ClinicInvite | null> {
    const record = await this.prismaService.clinicInvite.findUnique({ where: { id: id.value } });
    return record ? this.mapToEntity(record) : null;
  }

  async findByCode(code: string): Promise<ClinicInvite | null> {
    const record = await this.prismaService.clinicInvite.findUnique({ where: { code } });
    return record ? this.mapToEntity(record) : null;
  }

  async listActiveByClinicId(clinicId: Uuid, now: Date): Promise<ClinicInvite[]> {
    const records = await this.prismaService.clinicInvite.findMany({
      where: activeWhere(clinicId, now),
      orderBy: { createdAt: "desc" },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async countActiveByClinicId(clinicId: Uuid, now: Date): Promise<number> {
    return this.prismaService.clinicInvite.count({ where: activeWhere(clinicId, now) });
  }

  async consume(inviteId: Uuid, usedBy: Uuid, now: Date): Promise<boolean> {
    const result = await this.prismaService.clinicInvite.updateMany({
      where: { id: inviteId.value, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now, usedBy: usedBy.value },
    });
    return result.count === 1;
  }

  async release(inviteId: Uuid, usedBy: Uuid): Promise<void> {
    await this.prismaService.clinicInvite.updateMany({
      where: { id: inviteId.value, usedBy: usedBy.value },
      data: { usedAt: null, usedBy: null },
    });
  }

  async revoke(inviteId: Uuid, revokedAt: Date): Promise<void> {
    await this.prismaService.clinicInvite.updateMany({
      where: { id: inviteId.value, revokedAt: null },
      data: { revokedAt },
    });
  }

  async revokeActive(filter: { clinicId: Uuid; createdBy?: Uuid }, now: Date): Promise<void> {
    await this.prismaService.clinicInvite.updateMany({
      where: {
        ...activeWhere(filter.clinicId, now),
        ...(filter.createdBy ? { createdBy: filter.createdBy.value } : {}),
      },
      data: { revokedAt: now },
    });
  }

  private toData(invite: ClinicInvite) {
    return {
      id: invite.id.value,
      clinicId: invite.clinicId.value,
      code: invite.code,
      role: invite.role,
      createdBy: invite.createdBy.value,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      usedAt: invite.usedAt ?? null,
      usedBy: invite.usedBy?.value ?? null,
      revokedAt: invite.revokedAt ?? null,
    };
  }

  private mapToEntity(record: PrismaClinicInvite): ClinicInvite {
    return ClinicInvite.fromPersistence({
      id: new Uuid(record.id),
      clinicId: new Uuid(record.clinicId),
      code: record.code,
      role: record.role,
      createdBy: new Uuid(record.createdBy),
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt ?? undefined,
      usedBy: record.usedBy ? new Uuid(record.usedBy) : undefined,
      revokedAt: record.revokedAt ?? undefined,
    });
  }
}
