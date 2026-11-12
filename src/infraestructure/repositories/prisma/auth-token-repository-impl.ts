import { AuthToken as PrismaAuthToken, PrismaClient } from "@prisma/client";
import { AuthTokenRepository } from "../../../domain/repositories/auth-token-repository";
import { Uuid } from "@wave-telecom/framework/core";
import { AuthToken } from "../../../domain/entities/auth-token";

export class AuthTokenRepositoryImpl implements AuthTokenRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(authToken: AuthToken): Promise<void> {
    const data = {
      // Campo legado com o código em claro: limpo a cada gravação.
      token: null,
      tokenHash: authToken.tokenHash ?? null,
      expiresAt: authToken.expiresAt ?? null,
      attempts: authToken.attempts,
      consumedAt: authToken.consumedAt ?? null,
      sendCount: authToken.sendCount,
      sendWindowStart: authToken.sendWindowStart ?? null,
    };

    await this.prismaService.authToken.upsert({
      where: { id: authToken.id.value },
      create: {
        id: authToken.id.value,
        userId: authToken.userId.value,
        ...data,
      },
      update: data,
    });
  }

  async findByUserId(userId: Uuid): Promise<AuthToken | null> {
    const prismaAuthToken = await this.prismaService.authToken.findFirst({
      where: { userId: userId.value },
    });

    if (!prismaAuthToken) {
      return null;
    }
    return this.mapToEntity(prismaAuthToken);
  }

  private mapToEntity(authToken: PrismaAuthToken): AuthToken {
    return AuthToken.fromPersistence({
      id: new Uuid(authToken.id),
      userId: new Uuid(authToken.userId),
      tokenHash: authToken.tokenHash ?? undefined,
      expiresAt: authToken.expiresAt ?? undefined,
      attempts: authToken.attempts,
      consumedAt: authToken.consumedAt ?? undefined,
      sendCount: authToken.sendCount,
      sendWindowStart: authToken.sendWindowStart ?? undefined,
    });
  }
}
