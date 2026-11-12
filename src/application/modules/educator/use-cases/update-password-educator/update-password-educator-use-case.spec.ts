import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { AuthToken } from "../../../../../domain/entities/auth-token";
import { UpdatePasswordEducatorUseCase } from "./update-password-educator-use-case";
import { updatePasswordEducatorSchema } from "../../schemas/update-password-educator-schema";

function issueFor(userId: Uuid, now = new Date()) {
  const issued = AuthToken.issue({ userId, now });
  if (!issued.ok) throw new Error("issue falhou");
  return issued.value;
}

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
      save: vi.fn(),
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
    const wrong = code === "000000" ? "111111" : "000000";

    const result = await useCase.execute({
      email: educator.email,
      token: wrong,
      newPassword: "senhaNova123",
    });

    expect(result).toEqual({ ok: false, error: "INVALID_TOKEN" });
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
    expect(authTokenRepository.save).not.toHaveBeenCalled();
  });

  it("com código válido troca a senha, marca a data da troca e consome o código", async () => {
    const { authToken, code } = issueFor(educator.id);
    vi.mocked(authTokenRepository.findByUserId).mockResolvedValue(authToken);
    const before = Date.now();

    const result = await useCase.execute({
      email: educator.email,
      token: code,
      newPassword: "senhaNova123",
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(educatorRepository.save).toHaveBeenCalledWith(educator);
    expect(await bcrypt.compare("senhaNova123", educator.password)).toBe(true);
    expect(educator.passwordChangedAt!.getTime()).toBeGreaterThanOrEqual(before);

    const savedToken = vi.mocked(authTokenRepository.save).mock.calls[0][0];
    expect(savedToken.consumedAt).toBeDefined();
    expect(savedToken.check(code, new Date()).result).toEqual({
      ok: false,
      error: "INVALID_TOKEN",
    });
  });
});
