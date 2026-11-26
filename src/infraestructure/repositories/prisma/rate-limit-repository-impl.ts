import { Prisma, PrismaClient } from "@prisma/client";
import { RateLimitRepository } from "../../../domain/repositories/rate-limit-repository";

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

// Contador por chave (uma janela fixa), como os contadores do AuthToken:
// incremento condicional com updateMany, sem ler antes.
export class RateLimitRepositoryImpl implements RateLimitRepository {
  constructor(private prismaService: PrismaClient) {}

  async tryConsume(key: string, limit: number, expiresAt: Date): Promise<boolean> {
    // Janela já aberta e com espaço: conta mais uma.
    if (await this.increment(key, limit)) return true;

    // Primeira requisição da janela: cria o contador com 1.
    try {
      await this.prismaService.rateLimitCounter.create({
        data: { id: key, count: 1, expiresAt },
      });
      // Limpa os contadores de janelas já fechadas (uma vez por chave nova).
      await this.prismaService.rateLimitCounter.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }

    // O contador já existia (no limite) ou foi criado em paralelo: tenta contar
    // de novo; no limite, recusa.
    return this.increment(key, limit);
  }

  private async increment(key: string, limit: number): Promise<boolean> {
    const result = await this.prismaService.rateLimitCounter.updateMany({
      where: { id: key, count: { lt: limit } },
      data: { count: { increment: 1 } },
    });
    return result.count === 1;
  }
}
