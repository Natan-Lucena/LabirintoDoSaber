import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerateAuthTokenUseCase } from "./generate-auth-token-use-case";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import { MailService } from "../../../../services/mail-service";
import { AuthToken } from "../../../../../domain/entities/auth-token";
import { Uuid, success, failure } from "@wave-telecom/framework/core";

const mockEducatorRepository = (): EducatorRepository => ({
  search: vi.fn(),
} as unknown as EducatorRepository);

const mockAuthTokenRepository = (): AuthTokenRepository => ({
  findByUserId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
} as unknown as AuthTokenRepository);

const mockMailService = (): MailService => ({
  sendMail: vi.fn(),
} as unknown as MailService);

describe("GenerateAuthTokenUseCase", () => {
  let educatorRepository: EducatorRepository;
  let authTokenRepository: AuthTokenRepository;
  let mailerService: MailService;
  let useCase: GenerateAuthTokenUseCase;

  beforeEach(() => {
    educatorRepository = mockEducatorRepository();
    authTokenRepository = mockAuthTokenRepository();
    mailerService = mockMailService();
    useCase = new GenerateAuthTokenUseCase(
      educatorRepository,
      authTokenRepository,
      mailerService
    );
  });

  it("should fail if educator is not found", async () => {
    (educatorRepository.search as any).mockResolvedValue([]);

    const result = await useCase.execute("notfound@example.com");

    expect(result).toEqual(failure("EDUCATOR_NOT_FOUND"));
  });

  it("should generate a new token if educator exists and no previous token", async () => {
    const educatorId = Uuid.random();
    const educator = [{ id: educatorId, name: "John Doe", email: "john@example.com" }];

    (educatorRepository.search as any).mockResolvedValue(educator);
    (authTokenRepository.findByUserId as any).mockResolvedValue(null);
    (authTokenRepository.create as any).mockResolvedValue(void 0);
    (mailerService.sendMail as any).mockResolvedValue(void 0);

    const result = await useCase.execute("john@example.com");

    expect(result).toEqual(success(void 0));
    expect(authTokenRepository.create).toHaveBeenCalled();
    expect(mailerService.sendMail).toHaveBeenCalledWith(
      "john@example.com",
      expect.any(String),
      expect.stringContaining("Your authentication token is")
    );
  });

  it("should regenerate token if educator already has a token", async () => {
    const educatorId = Uuid.random();
    const educator = [{ id: educatorId, name: "Jane Doe", email: "jane@example.com" }];
    const existingToken = AuthToken.create(educatorId);

    (educatorRepository.search as any).mockResolvedValue(educator);
    (authTokenRepository.findByUserId as any).mockResolvedValue(existingToken);
    (authTokenRepository.update as any).mockResolvedValue(void 0);
    (mailerService.sendMail as any).mockResolvedValue(void 0);

    const result = await useCase.execute("jane@example.com");

    expect(result).toEqual(success(void 0));
    expect(existingToken.token).toBeDefined();
    expect(authTokenRepository.update).toHaveBeenCalledWith(existingToken);
    expect(mailerService.sendMail).toHaveBeenCalledWith(
      "jane@example.com",
      expect.any(String),
      expect.stringContaining("Your new authentication token is")
    );
  });
});
