import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { AuthService } from "../../../../services/auth-service";
import { ChangePasswordUseCase } from "./change-password-use-case";
import { changePasswordSchema } from "../../schemas/change-password-schema";

describe("ChangePasswordUseCase", () => {
  let educatorRepository: EducatorRepository;
  let authService: AuthService;
  let useCase: ChangePasswordUseCase;
  let educator: Educator;

  beforeEach(async () => {
    educator = Educator.create({
      name: "Maria",
      email: "maria@example.com",
      password: await bcrypt.hash("senhaAtual", 4),
    });
    educatorRepository = {
      save: vi.fn(),
    } as unknown as EducatorRepository;
    authService = {
      generateToken: vi.fn().mockResolvedValue({ token: "jwt-novo" }),
      verifyToken: vi.fn(),
    };
    useCase = new ChangePasswordUseCase(educatorRepository, authService);
  });

  it("senha atual errada devolve INVALID_CURRENT_PASSWORD", async () => {
    const result = await useCase.execute({
      educator,
      currentPassword: "errada",
      newPassword: "senhaNova123",
    });

    expect(result).toEqual({ ok: false, error: "INVALID_CURRENT_PASSWORD" });
    expect(educatorRepository.save).not.toHaveBeenCalled();
    expect(authService.generateToken).not.toHaveBeenCalled();
  });

  it("nova senha igual à atual devolve PASSWORD_SAME_AS_OLD", async () => {
    const result = await useCase.execute({
      educator,
      currentPassword: "senhaAtual",
      newPassword: "senhaAtual",
    });

    expect(result).toEqual({ ok: false, error: "PASSWORD_SAME_AS_OLD" });
    expect(educatorRepository.save).not.toHaveBeenCalled();
  });

  it("troca a senha, marca a data da troca e devolve um token novo", async () => {
    const before = Date.now();

    const result = await useCase.execute({
      educator,
      currentPassword: "senhaAtual",
      newPassword: "senhaNova123",
    });

    expect(result).toEqual({ ok: true, value: { token: "jwt-novo" } });
    expect(await bcrypt.compare("senhaNova123", educator.password)).toBe(true);
    expect(educator.passwordChangedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(educatorRepository.save).toHaveBeenCalledWith(educator);
  });

  it("o token novo é gerado depois de gravar a troca", async () => {
    const order: string[] = [];
    vi.mocked(educatorRepository.save).mockImplementation(async (e) => {
      order.push("save");
      return e;
    });
    vi.mocked(authService.generateToken).mockImplementation(async () => {
      order.push("token");
      return { token: "jwt-novo" };
    });

    await useCase.execute({
      educator,
      currentPassword: "senhaAtual",
      newPassword: "senhaNova123",
    });

    expect(order).toEqual(["save", "token"]);
  });

  it("validação exige nova senha de 6 a 100 caracteres", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "senhaAtual",
        newPassword: "12345",
      }).success
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "senhaAtual",
        newPassword: "a".repeat(101),
      }).success
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "senhaAtual",
        newPassword: "senhaNova123",
      }).success
    ).toBe(true);
  });
});
