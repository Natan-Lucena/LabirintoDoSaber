import { PrismaClient, PushToken as PrismaPushToken } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { PushPlatform, PushToken } from "../../../domain/entities/push-token";
import { PushTokenRepository } from "../../../domain/repositories/push-token-repository";

export class PushTokenRepositoryImpl implements PushTokenRepository {
  constructor(private prismaService: PrismaClient) {}

  async findByToken(token: string): Promise<PushToken | null> {
    const record = await this.prismaService.pushToken.findUnique({ where: { token } });
    return record ? this.mapToEntity(record) : null;
  }

  async save(pushToken: PushToken): Promise<void> {
    const data = {
      token: pushToken.token,
      educatorId: pushToken.educatorId.value,
      platform: pushToken.platform,
      createdAt: pushToken.createdAt,
      lastSeenAt: pushToken.lastSeenAt,
    };
    // Pelo token (índice único): dois registros em paralelo do mesmo aparelho
    // não esbarram no P2002. O id fica o do primeiro.
    const { token, createdAt, ...changes } = data;
    await this.prismaService.pushToken.upsert({
      where: { token },
      update: changes,
      create: { id: pushToken.id.value, ...data },
    });
  }

  async listByEducatorIds(educatorIds: Uuid[]): Promise<PushToken[]> {
    if (educatorIds.length === 0) return [];
    const records = await this.prismaService.pushToken.findMany({
      where: { educatorId: { in: educatorIds.map((id) => id.value) } },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async deleteByIds(ids: Uuid[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prismaService.pushToken.deleteMany({
      where: { id: { in: ids.map((id) => id.value) } },
    });
  }

  async deleteForEducator(token: string, educatorId: Uuid): Promise<void> {
    await this.prismaService.pushToken.deleteMany({
      where: { token, educatorId: educatorId.value },
    });
  }

  async deleteByTokens(tokens: string[]): Promise<number> {
    if (tokens.length === 0) return 0;
    const result = await this.prismaService.pushToken.deleteMany({
      where: { token: { in: tokens } },
    });
    return result.count;
  }

  private mapToEntity(record: PrismaPushToken): PushToken {
    return PushToken.fromPersistence({
      id: new Uuid(record.id),
      token: record.token,
      educatorId: new Uuid(record.educatorId),
      platform: record.platform as PushPlatform,
      createdAt: record.createdAt,
      lastSeenAt: record.lastSeenAt,
    });
  }
}
