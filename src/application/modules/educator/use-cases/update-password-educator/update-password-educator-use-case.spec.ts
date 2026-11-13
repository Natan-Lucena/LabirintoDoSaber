import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { AuthToken } from "../../../../../domain/entities/auth-token";
import { MockAuthTokenRepository } from "../../../../../infraestructure/repositories/mock/auth-token-repository-impl";
import { UpdatePasswordEducatorUseCase } from "./update-password-educator-use-case";
import { updatePasswordEducatorSchema } from "../../schemas/update-password-educator-schema";

function issueFor(userId: Uuid, now = new Date()) {
  const issued = AuthToken.issue({ userId, now });
  if (!issued.ok) throw new Error("issue falhou");
  return issued.value;
}

const wrongCodeFor = (code: string) => (code === "000000" ? "111111" : "000000");

describe("UpdatePasswordEducatorUseCase", () => {
  let educatorRepository: EducatorRepository;
  let authTokenRepository: AuthTokenRepository;
  let useCase: UpdatePasswordEducatorUseCase;
  let educator: Educator;

  beforeEach(async () => {
    educator = Educator.create({
      name: "Maria",
      email: "maria@example.com",
      password: await bcrypt.hash("senhaAntiga", 4),
    });
    educatorRepository = {
      getByEmail: vi.fn().mockResolvedValue(educator),
      save: vi.fn(),
    } as unknown as EducatorRepository;
    authTokenRepository = {
      findByUserId: vi.fn().mockResolvedValue(null),
      registerAttempt: vi.fn().mockResolvedValue(true),
      refundAttempt: vi.fn().mockResolvedValue(undefined),
      consume: vi.fn().mockResolvedValue(true),
    } as unknown as AuthTokenRepository;
    useCase = new UpdatePasswordEducatorUseCase(
      educatorRepository,
      authTokenRepository
    );
  });

  it("corpo sem token é recusado pela validação (400)", () => {
    const parsed = updatePasswordEducatorSchema.safeParse({
      email: "maria@example.com",
      newPassword: "senhaNova123",
    });

    expect(parsed.success).toBe(false);
  });

  it("token fora do formato de 6 dígitos é recusado pela validação", () => {
    const parsed = updatePasswordEducatorSchema.safeParse({
      email: "maria@example.com",
      token: "abc123",
      newPassword: "senhaNova123",
    });

    expect(parsed.success).toBe(false);
  });

  it("nova senha fora de 6 a 100 caracteres é recusada pela validação", () => {
    const base = { email: "maria@example.com", token: "123456" };

    expect(
      updatePasswordEducatorSchema.safeParse({ ...base, newPassword: "12345" })
        .success
    ).toBe(false);
    expect(
      updatePasswordEducatorSchema.safeParse({
        ...base,
        newPassword: "a".repeat(101),
      }).success
    ).toBe(false);
  });

  it("e-mail inexistente devolve INVALID_TOKEN", async () => {
    vi.mocked(educatorRepository.getByEmail).mockResolvedValue(null);

    const result = await useCase.execute({
      email: "ninguem@example.com",
      token: "123456",
      newPassword: "senhaNova123",
    });

    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
    expect(educatorRepository.save).not.toHaveBeenCalled();
  });

  it("token errado devolve INVALID_TOKEN e não troca a senha", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);

    const result = await useCase.execute({
      email: educator.email,
      token: wrongCodeFor(code),
      newPassword: "senhaNova123",
    });

    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
    expect(authTokenRepository.registerAttempt).toHaveBeenCalledTimes(1);
    expect(authTokenRepository.consume).not.toHaveBeenCalled();
    expect(educatorRepository.save).not.toHaveBeenCalled();
  });

  it("token vencido devolve EXPIRED_TOKEN", async () => {
    const { authToken, code } = issueFor(
      educator.id,
      new Date(Date.now() - 16 * 60 * 1000)
    );
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);

    const result = await useCase.execute({
      email: educator.email,
      token: code,
      newPassword: "senhaNova123",
    });

    expect(result).toEqual({ ok: false, error: "EXPIRED_TOKEN" });
    expect(educatorRepository.save).not.toHaveBeenCalled();
  });

  it("senha igual à atual devolve PASSWORD_SAME_AS_OLD sem consumir o código", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);

    const result = await useCase.execute({
      email: educator.email,
      token: code,
      newPassword: "senhaAntiga",
    });

    expect(result).toEqual({ ok: false, error: "PASSWORD_SAME_AS_OLD" });
    expect(educatorRepository.save).not.toHaveBeenCalled();
    expect(authTokenRepository.consume).not.toHaveBeenCalled();
  });

  it("com código válido consome o código, troca a senha e marca a data da troca", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);
    const before = Date.now();

    const result = await useCase.execute({
      email: educator.email,
      token: code,
      newPassword: "senhaNova123",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(authTokenRepository.consume).toHaveBeenCalledWith(
      authToken,
      expect.any(Date)
    );
    expect(educatorRepository.save).toHaveBeenCalledWith(educator);
    expect(await bcrypt.compare("senhaNova123", educator.password)).toBe(true);
    expect(educator.passwordChangedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("código já consumido por outra requisição devolve INVALID_TOKEN sem trocar a senha", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);
    vi.mocked(authTokenRepository.consume).mockResolvedValue(false);

    const result = await useCase.execute({
      email: educator.email,
      token: code,
      newPassword: "senhaNova123",
    });

    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
    expect(educatorRepository.save).not.toHaveBeenCalled();
    expect(await bcrypt.compare("senhaAntiga", educator.password)).toBe(true);
  });

  it("duas trocas em paralelo com o mesmo código: só uma passa", async () => {
    const repository = new MockAuthTokenRepository();
    const { authToken, code } = issueFor(educator.id);
    await repository.create(authToken);
    useCase = new UpdatePasswordEducatorUseCase(educatorRepository, repository);

    const results = await Promise.all([
      useCase.execute({
        email: educator.email,
        token: code,
        newPassword: "senhaNova123",
      }),
      useCase.execute({
        email: educator.email,
        token: code,
        newPassword: "outraSenha456",
      }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([
      { ok: false, error: "INVALID_TOKEN" },
    ]);
    expect(educatorRepository.save).toHaveBeenCalledTimes(1);
    expect(
      (await repository.findByUserId(educator.id))!.consumedAt
    ).toBeDefined();
  });
});
