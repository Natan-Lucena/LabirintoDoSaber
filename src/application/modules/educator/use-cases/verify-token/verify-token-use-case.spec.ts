import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { VerifyTokenUseCase } from "./verify-token-use-case";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import {
  AuthToken,
  AuthTokenProps,
} from "../../../../../domain/entities/auth-token";
import { Educator } from "../../../../../domain/entities/educator";
import { MockAuthTokenRepository } from "../../../../../infraestructure/repositories/mock/auth-token-repository-impl";

function issueFor(userId: Uuid, now = new Date()) {
  const issued = AuthToken.issue({ userId, now });
  if (!issued.ok) throw new Error("issue falhou");
  return issued.value;
}

function withChanges(token: AuthToken, changes: Partial<AuthTokenProps>) {
  return AuthToken.fromPersistence({
    id: token.id,
    userId: token.userId,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
    attempts: token.attempts,
    consumedAt: token.consumedAt,
    sendCount: token.sendCount,
    sendWindowStart: token.sendWindowStart,
    ...changes,
  });
}

const wrongCodeFor = (code: string) => (code === "000000" ? "111111" : "000000");

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
      registerAttempt: vi.fn().mockResolvedValue(true),
      consume: vi.fn(),
    } as unknown as AuthTokenRepository;
    useCase = new VerifyTokenUseCase(educatorRepository, authTokenRepository);
  });

  it("código correto devolve valid: true sem consumir", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);

    const result = await useCase.execute({ email: educator.email, token: code });

    expect(result).toEqual({ ok: true, value: { valid: true } });
    expect(authTokenRepository.registerAttempt).toHaveBeenCalledWith(
      authToken.id
    );
    expect(authTokenRepository.consume).not.toHaveBeenCalled();
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

  it("código errado devolve INVALID_TOKEN e conta a tentativa", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);

    const result = await useCase.execute({
      email: educator.email,
      token: wrongCodeFor(code),
    });

    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
    expect(authTokenRepository.registerAttempt).toHaveBeenCalledTimes(1);
  });

  it("código vencido devolve EXPIRED_TOKEN sem contar tentativa", async () => {
    const { authToken, code } = issueFor(
      educator.id,
      new Date(Date.now() - 16 * 60 * 1000)
    );
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);

    const result = await useCase.execute({ email: educator.email, token: code });

    expect(result).toEqual({ ok: false, error: "EXPIRED_TOKEN" });
    expect(authTokenRepository.registerAttempt).not.toHaveBeenCalled();
  });

  it("código com 5 tentativas devolve TOO_MANY_ATTEMPTS", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(
      withChanges(authToken, { attempts: 5 })
    );

    const result = await useCase.execute({ email: educator.email, token: code });

    expect(result).toEqual({ ok: false, error: "TOO_MANY_ATTEMPTS" });
    expect(authTokenRepository.registerAttempt).not.toHaveBeenCalled();
  });

  it("tentativa que o contador atômico recusa devolve TOO_MANY_ATTEMPTS, mesmo com o código certo", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId)
      .mockResolvedValueOnce(withChanges(authToken, { attempts: 4 }))
      .mockResolvedValueOnce(withChanges(authToken, { attempts: 5 }));
    vi.mocked(authTokenRepository.registerAttempt).mockResolvedValue(false);

    const result = await useCase.execute({ email: educator.email, token: code });

    expect(result).toEqual({ ok: false, error: "TOO_MANY_ATTEMPTS" });
  });

  it("tentativa recusada porque o código foi usado no meio do caminho devolve INVALID_TOKEN", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId)
      .mockResolvedValueOnce(authToken)
      .mockResolvedValueOnce(withChanges(authToken, { consumedAt: new Date() }));
    vi.mocked(authTokenRepository.registerAttempt).mockResolvedValue(false);

    const result = await useCase.execute({ email: educator.email, token: code });

    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
  });

  describe("com tentativas em paralelo", () => {
    let repository: MockAuthTokenRepository;

    beforeEach(() => {
      repository = new MockAuthTokenRepository();
      useCase = new VerifyTokenUseCase(educatorRepository, repository);
    });

    it("tentativas paralelas contam todas e param no limite de 5", async () => {
      const { authToken, code } = issueFor(educator.id);
      await repository.create(authToken);

      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          useCase.execute({ email: educator.email, token: wrongCodeFor(code) })
        )
      );

      expect(results.every((r) => !r.ok)).toBe(true);
      expect((await repository.findByUserId(educator.id))!.attempts).toBe(5);
      expect(
        await useCase.execute({ email: educator.email, token: code })
      ).toEqual({ ok: false, error: "TOO_MANY_ATTEMPTS" });
    });

    it("com 4 tentativas usadas, só uma de duas tentativas paralelas é conferida", async () => {
      const { authToken, code } = issueFor(educator.id);
      await repository.create(withChanges(authToken, { attempts: 4 }));

      const results = await Promise.all([
        useCase.execute({ email: educator.email, token: code }),
        useCase.execute({ email: educator.email, token: code }),
      ]);

      expect(results).toEqual([
        { ok: true, value: { valid: true } },
        { ok: false, error: "TOO_MANY_ATTEMPTS" },
      ]);
      expect((await repository.findByUserId(educator.id))!.attempts).toBe(5);
    });
  });
});
