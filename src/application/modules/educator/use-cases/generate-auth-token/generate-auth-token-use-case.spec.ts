import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GenerateAuthTokenUseCase } from "./generate-auth-token-use-case";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import { MailService } from "../../../../services/mail-service";
import { AuthToken } from "../../../../../domain/entities/auth-token";
import { Educator } from "../../../../../domain/entities/educator";

describe("GenerateAuthTokenUseCase", () => {
  let educatorRepository: EducatorRepository;
  let authTokenRepository: AuthTokenRepository;
  let mailService: MailService;
  let useCase: GenerateAuthTokenUseCase;
  let educator: Educator;

  beforeEach(() => {
    educatorRepository = {
      getByEmail: vi.fn(),
    } as unknown as EducatorRepository;
    authTokenRepository = {
      findByUserId: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    } as unknown as AuthTokenRepository;
    mailService = {
      sendMail: vi.fn().mockResolvedValue(undefined),
    } as unknown as MailService;
    useCase = new GenerateAuthTokenUseCase(
      educatorRepository,
      authTokenRepository,
      mailService
    );
    educator = Educator.create({
      name: "Maria",
      email: "maria@example.com",
      password: "hash",
    });
  });

  it("e-mail inexistente responde sucesso sem gravar nem enviar nada", async () => {
    vi.mocked(educatorRepository.getByEmail).mockResolvedValue(null);

    const result = await useCase.execute("ninguem@example.com");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(authTokenRepository.save).not.toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("grava um código novo e envia por e-mail", async () => {
    vi.mocked(educatorRepository.getByEmail).mockResolvedValue(educator);

    const result = await useCase.execute("maria@example.com");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(authTokenRepository.save).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(authTokenRepository.save).mock.calls[0][0];
    expect(saved.userId.value).toBe(educator.id.value);

    expect(mailService.sendMail).toHaveBeenCalledTimes(1);
    const [to, , body] = vi.mocked(mailService.sendMail).mock.calls[0];
    expect(to).toBe("maria@example.com");
    const code = body.match(/\b\d{6}\b/)?.[0];
    expect(code).toBeDefined();
    expect(saved.check(code!, new Date()).result.ok).toBe(true);
    expect(body).not.toMatch(/https?:\/\//);
  });

  it("código novo substitui o anterior no mesmo registro", async () => {
    vi.mocked(educatorRepository.getByEmail).mockResolvedValue(educator);
    const issued = AuthToken.issue({ userId: educator.id, now: new Date() });
    if (!issued.ok) throw new Error("issue falhou");
    const previous = issued.value.authToken;
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(previous);

    await useCase.execute("maria@example.com");

    const saved = vi.mocked(authTokenRepository.save).mock.calls[0][0];
    expect(saved.id.value).toBe(previous.id.value);
    expect(saved.tokenHash).not.toBe(previous.tokenHash);
    expect(saved.sendCount).toBe(2);
  });

  it("4º envio em 15 minutos devolve TOO_MANY_REQUESTS sem enviar", async () => {
    vi.mocked(educatorRepository.getByEmail).mockResolvedValue(educator);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(
      AuthToken.fromPersistence({
        id: Uuid.random(),
        userId: educator.id,
        tokenHash: "x",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        sendCount: 3,
        sendWindowStart: new Date(Date.now() - 5 * 60 * 1000),
      })
    );

    const result = await useCase.execute("maria@example.com");

    expect(result).toEqual({ ok: false, error: "TOO_MANY_REQUESTS" });
    expect(authTokenRepository.save).not.toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("falha no envio do e-mail não muda a resposta", async () => {
    vi.mocked(educatorRepository.getByEmail).mockResolvedValue(educator);
    vi.mocked(mailService.sendMail).mockRejectedValue(new Error("SMTP down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await useCase.execute("maria@example.com");

    expect(result).toEqual({ ok: true, value: undefined });
  });
});
