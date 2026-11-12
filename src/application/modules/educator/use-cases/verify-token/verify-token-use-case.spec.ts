import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { VerifyTokenUseCase } from "./verify-token-use-case";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import { AuthToken } from "../../../../../domain/entities/auth-token";
import { Educator } from "../../../../../domain/entities/educator";

function issueFor(userId: Uuid, now = new Date()) {
  const issued = AuthToken.issue({ userId, now });
  if (!issued.ok) throw new Error("issue falhou");
  return issued.value;
}

describe("VerifyTokenUseCase", () => {
  let educatorRepository: EducatorRepository;
  let authTokenRepository: AuthTokenRepository;
  let useCase: VerifyTokenUseCase;
  let educator: Educator;

  beforeEach(() => {
    educator = Educator.create({
      name: "Maria",
      email: "maria@example.com",
      password: "hash",
    });
    educatorRepository = {
      getByEmail: vi.fn().mockResolvedValue(educator),
    } as unknown as EducatorRepository;
    authTokenRepository = {
      findByUserId: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    } as unknown as AuthTokenRepository;
    useCase = new VerifyTokenUseCase(educatorRepository, authTokenRepository);
  });

  it("código correto devolve valid: true sem consumir", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);

    const result = await useCase.execute({ email: educator.email, token: code });

    expect(result).toEqual({ ok: true, value: { valid: true } });
    expect(authTokenRepository.save).not.toHaveBeenCalled();
  });

  it("e-mail inexistente devolve INVALID_TOKEN", async () => {
    vi.mocked(educatorRepository.getByEmail).mockResolvedValue(null);

    const result = await useCase.execute({
      email: "ninguem@example.com",
      token: "123456",
    });

    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
  });

  it("sem código gerado devolve INVALID_TOKEN", async () => {
    const result = await useCase.execute({
      email: educator.email,
      token: "123456",
    });

    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
  });

  it("código errado devolve INVALID_TOKEN e grava a tentativa", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);
    const wrong = code === "000000" ? "111111" : "000000";

    const result = await useCase.execute({ email: educator.email, token: wrong });

    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
    expect(authTokenRepository.save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(authTokenRepository.save).mock.calls[0][0].attempts).toBe(1);
  });

  it("código vencido devolve EXPIRED_TOKEN", async () => {
    const { authToken, code } = issueFor(
      educator.id,
      new Date(Date.now() - 16 * 60 * 1000)
    );
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);

    const result = await useCase.execute({ email: educator.email, token: code });

    expect(result).toEqual({ ok: false, error: "EXPIRED_TOKEN" });
  });

  it("código com 5 tentativas devolve TOO_MANY_ATTEMPTS", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(
      AuthToken.fromPersistence({
        id: authToken.id,
        userId: authToken.userId,
        tokenHash: authToken.tokenHash,
        expiresAt: authToken.expiresAt,
        attempts: 5,
        sendCount: authToken.sendCount,
        sendWindowStart: authToken.sendWindowStart,
      })
    );

    const result = await useCase.execute({ email: educator.email, token: code });

    expect(result).toEqual({ ok: false, error: "TOO_MANY_ATTEMPTS" });
  });
});
