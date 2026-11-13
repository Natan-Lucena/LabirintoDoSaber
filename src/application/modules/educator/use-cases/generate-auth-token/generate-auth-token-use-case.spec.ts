import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GenerateAuthTokenUseCase } from "./generate-auth-token-use-case";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import { MailService } from "../../../../services/mail-service";
import { AuthToken } from "../../../../../domain/entities/auth-token";
import { Educator } from "../../../../../domain/entities/educator";
import { MockAuthTokenRepository } from "../../../../../infraestructure/repositories/mock/auth-token-repository-impl";

const MINUTE = 60 * 1000;

function tokenWithSends(userId: Uuid, sendCount: number, windowAgoMs: number) {
  return AuthToken.fromPersistence({
    id: Uuid.random(),
    userId,
    tokenHash: "ab",
    expiresAt: new Date(Date.now() + 10 * MINUTE),
    attempts: 0,
    sendCount,
    sendWindowStart: new Date(Date.now() - windowAgoMs),
  });
}

describe("GenerateAuthTokenUseCase", () => {
  let educatorRepository: EducatorRepository;
  let authTokenRepository: AuthTokenRepository;
  let mailService: MailService;
  let useCase: GenerateAuthTokenUseCase;
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
      create: vi.fn(),
      saveIssued: vi.fn().mockResolvedValue(true),
    } as unknown as AuthTokenRepository;
    mailService = {
      sendMail: vi.fn().mockResolvedValue(undefined),
    } as unknown as MailService;
    useCase = new GenerateAuthTokenUseCase(
      educatorRepository,
      authTokenRepository,
      mailService
    );
  });

  it("e-mail inexistente responde sucesso sem gravar nem enviar nada", async () => {
    vi.mocked(educatorRepository.getByEmail).mockResolvedValue(null);

    const result = await useCase.execute("ninguem@example.com");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(authTokenRepository.create).not.toHaveBeenCalled();
    expect(authTokenRepository.saveIssued).not.toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("primeiro código do educador cria o registro e envia por e-mail", async () => {
    const result = await useCase.execute("maria@example.com");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(authTokenRepository.create).toHaveBeenCalledTimes(1);
    const created = vi.mocked(authTokenRepository.create).mock.calls[0][0];
    expect(created.userId.value).toBe(educator.id.value);

    expect(mailService.sendMail).toHaveBeenCalledTimes(1);
    const [to, , body] = vi.mocked(mailService.sendMail).mock.calls[0];
    expect(to).toBe("maria@example.com");
    const code = body.match(/\b\d{6}\b/)?.[0];
    expect(code).toBeDefined();
    expect(created.check(code!, new Date()).ok).toBe(true);
    expect(body).not.toMatch(/https?:\/\//);
  });

  it("código novo substitui o anterior no mesmo registro", async () => {
    const previous = tokenWithSends(educator.id, 1, MINUTE);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(previous);

    await useCase.execute("maria@example.com");

    expect(authTokenRepository.create).not.toHaveBeenCalled();
    const saved = vi.mocked(authTokenRepository.saveIssued).mock.calls[0][0];
    expect(saved.id.value).toBe(previous.id.value);
    expect(saved.tokenHash).not.toBe(previous.tokenHash);
    expect(mailService.sendMail).toHaveBeenCalledTimes(1);
  });

  it("4º envio em 15 minutos devolve TOO_MANY_REQUESTS sem enviar", async () => {
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(
      tokenWithSends(educator.id, 3, 5 * MINUTE)
    );

    const result = await useCase.execute("maria@example.com");

    expect(result).toEqual({ ok: false, error: "TOO_MANY_REQUESTS" });
    expect(authTokenRepository.saveIssued).not.toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("envio recusado pelo contador atômico devolve TOO_MANY_REQUESTS sem enviar", async () => {
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(
      tokenWithSends(educator.id, 2, MINUTE)
    );
    vi.mocked(authTokenRepository.saveIssued).mockResolvedValue(false);

    const result = await useCase.execute("maria@example.com");

    expect(result).toEqual({ ok: false, error: "TOO_MANY_REQUESTS" });
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("pedidos em paralelo não passam de 3 envios na janela", async () => {
    const repository = new MockAuthTokenRepository();
    await repository.create(tokenWithSends(educator.id, 1, MINUTE));
    useCase = new GenerateAuthTokenUseCase(
      educatorRepository,
      repository,
      mailService
    );

    const results = await Promise.all(
      Array.from({ length: 4 }, () => useCase.execute("maria@example.com"))
    );

    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, error: "TOO_MANY_REQUESTS" },
      { ok: false, error: "TOO_MANY_REQUESTS" },
    ]);
    expect(mailService.sendMail).toHaveBeenCalledTimes(2);
    expect((await repository.findByUserId(educator.id))!.sendCount).toBe(3);
  });

  it("janela vencida reinicia a contagem", async () => {
    const repository = new MockAuthTokenRepository();
    await repository.create(tokenWithSends(educator.id, 3, 16 * MINUTE));
    useCase = new GenerateAuthTokenUseCase(
      educatorRepository,
      repository,
      mailService
    );

    const result = await useCase.execute("maria@example.com");

    expect(result).toEqual({ ok: true, value: undefined });
    expect((await repository.findByUserId(educator.id))!.sendCount).toBe(1);
  });

  it("falha no envio do e-mail não muda a resposta", async () => {
    vi.mocked(mailService.sendMail).mockRejectedValue(new Error("SMTP down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await useCase.execute("maria@example.com");

    expect(result).toEqual({ ok: true, value: undefined });
  });
});
