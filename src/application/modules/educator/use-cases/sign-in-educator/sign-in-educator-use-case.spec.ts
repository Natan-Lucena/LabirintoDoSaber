import { describe, it, expect, vi, beforeEach } from "vitest";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { SignInEducatorUseCase } from "./sign-in-educator-use-case";
import { AuthService } from "../../../../services/auth-service";
import bcrypt from "bcrypt";

const mockEducatorRepository = (): EducatorRepository => {
  return {
    getByEmail: vi.fn(),
    save: vi.fn(),
  } as unknown as EducatorRepository;
};

const mockAuthService = (): AuthService => {
  return {
    generateToken: vi.fn(),
  } as unknown as AuthService;
};

describe("SignInEducatorUseCase", () => {
  let educatorRepository: EducatorRepository;
  let authService: AuthService;
  let useCase: SignInEducatorUseCase;

  beforeEach(() => {
    educatorRepository = mockEducatorRepository();
    authService = mockAuthService();
    useCase = new SignInEducatorUseCase(educatorRepository, authService);
  });

  it("should fail if educator does not exist", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue(null);

    const result = await useCase.execute({
      email: "nonexistent@example.com",
      password: "password123",
    });

    expect(result).toEqual(failure("INVALID_CREDENTIALS"));
    expect(authService.generateToken).not.toHaveBeenCalled();
  });

  it("should fail if password is invalid", async () => {
    const mockEducator = Educator.create({
      id: Uuid.random(),
      name: "John Doe",
      email: "john@example.com",
      password: await bcrypt.hash("correctpassword", 10),
      createdAt: new Date(),    
    });

    (educatorRepository.getByEmail as any).mockResolvedValue(mockEducator);

    const result = await useCase.execute({
      email: "john@example.com",
      password: "wrongpassword",
    });

    expect(result).toEqual(failure("INVALID_CREDENTIALS"));
    expect(authService.generateToken).not.toHaveBeenCalled();
  });

  it("should return token if credentials are valid", async () => {
    const mockEducator = Educator.create({
      id: Uuid.random(),
      name: "Jane Doe",
      email: "jane@example.com",
      password: await bcrypt.hash("password123", 10),
      createdAt: new Date(),
    });

    (educatorRepository.getByEmail as any).mockResolvedValue(mockEducator);
    (authService.generateToken as any).mockResolvedValue("mocked-token");

    const result = await useCase.execute({
      email: "jane@example.com",
      password: "password123",
    });

    expect(result).toEqual(success("mocked-token"));
    expect(authService.generateToken).toHaveBeenCalledWith(mockEducator);
  });
});
