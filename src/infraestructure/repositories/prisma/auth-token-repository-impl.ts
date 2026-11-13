import { AuthToken as PrismaAuthToken, PrismaClient } from "@prisma/client";
import { AuthTokenRepository } from "../../../domain/repositories/auth-token-repository";
import { Uuid } from "@wave-telecom/framework/core";
import {
  AUTH_TOKEN_MAX_ATTEMPTS,
  AUTH_TOKEN_SEND_LIMIT,
  AUTH_TOKEN_SEND_WINDOW_MS,
  AuthToken,
} from "../../../domain/entities/auth-token";

export class AuthTokenRepositoryImpl implements AuthTokenRepository {
  constructor(private prismaService: PrismaClient) {}

  async findByUserId(userId: Uuid): Promise<AuthToken | null> {
    const prismaAuthToken = await this.prismaService.authToken.findFirst({
      where: { userId: userId.value },
    });

    if (!prismaAuthToken) {
      return null;
    }
    return this.mapToEntity(prismaAuthToken);
  }

  async create(authToken: AuthToken): Promise<void> {
    await this.prismaService.authToken.create({
      data: {
        id: authToken.id.value,
        userId: authToken.userId.value,
        ...this.codeData(authToken),
        sendCount: authToken.sendCount,
        sendWindowStart: authToken.sendWindowStart ?? null,
      },
    });
  }

  async saveIssued(authToken: AuthToken, now: Date): Promise<boolean> {
    const windowStartLimit = new Date(
      now.getTime() - AUTH_TOKEN_SEND_WINDOW_MS
    );

    // Janela aberta e com espaço: conta mais um envio.
    const counted = await this.prismaService.authToken.updateMany({
      where: {
        id: authToken.id.value,
        sendWindowStart: { gt: windowStartLimit },
        sendCount: { lt: AUTH_TOKEN_SEND_LIMIT },
      },
      data: {
        ...this.codeData(authToken),
        sendCount: { increment: 1 },
      },
    });
    if (counted.count === 1) return true;

    // Janela fechada (ou nunca aberta): reinicia com este envio.
    const restarted = await this.prismaService.authToken.updateMany({
      where: {
        id: authToken.id.value,
        OR: [
          { sendWindowStart: null },
          { sendWindowStart: { isSet: false } },
          { sendWindowStart: { lte: windowStartLimit } },
        ],
      },
      data: {
        ...this.codeData(authToken),
        sendCount: 1,
        sendWindowStart: now,
      },
    });
    return restarted.count === 1;
  }

  async registerAttempt(authToken: AuthToken): Promise<boolean> {
    const result = await this.prismaService.authToken.updateMany({
      where: {
        id: authToken.id.value,
        tokenHash: authToken.tokenHash ?? null,
        attempts: { lt: AUTH_TOKEN_MAX_ATTEMPTS },
        consumedAt: null,
      },
      data: { attempts: { increment: 1 } },
    });
    return result.count === 1;
  }

  async refundAttempt(authToken: AuthToken): Promise<void> {
    await this.prismaService.authToken.updateMany({
      where: {
        id: authToken.id.value,
        tokenHash: authToken.tokenHash ?? null,
        attempts: { gt: 0 },
      },
      data: { attempts: { decrement: 1 } },
    });
  }

  async consume(authToken: AuthToken, consumedAt: Date): Promise<boolean> {
    const result = await this.prismaService.authToken.updateMany({
      where: {
        id: authToken.id.value,
        tokenHash: authToken.tokenHash ?? null,
        consumedAt: null,
      },
      data: { consumedAt },
    });
    return result.count === 1;
  }

  private codeData(authToken: AuthToken) {
    return {
      // Campo legado com o código em claro: limpo a cada código novo.
      token: null,
      tokenHash: authToken.tokenHash ?? null,
      expiresAt: authToken.expiresAt ?? null,
      attempts: 0,
      consumedAt: null,
    };
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
