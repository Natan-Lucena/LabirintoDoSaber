import { describe, it, expect, vi, beforeEach } from "vitest";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { success, failure } from "@wave-telecom/framework/core";
import { RegisterEducatorUseCase } from "./register-educator-use-case";

const mockEducatorRepository = (): EducatorRepository => {
  return {
    getByEmail: vi.fn(),
    save: vi.fn(),
  } as unknown as EducatorRepository;
};

describe("RegisterEducatorUseCase", () => {
  let educatorRepository: EducatorRepository;
  let useCase: RegisterEducatorUseCase;

  beforeEach(() => {
    educatorRepository = mockEducatorRepository();
    useCase = new RegisterEducatorUseCase(educatorRepository);
  });

  it("should fail if educator already exists", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue(true);

    const result = await useCase.execute({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
    });

    expect(result).toEqual(failure("EDUCATOR_ALREADY_EXISTS"));
    expect(educatorRepository.save).not.toHaveBeenCalled();
  });

  it("should create educator if not exists", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue(null);

    const result = await useCase.execute({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
    });

    expect(result).toEqual(success(void 0));
    expect(educatorRepository.save).toHaveBeenCalled();
    const savedEducator = (educatorRepository.save as any).mock.calls[0][0];
    expect(savedEducator.name).toBe("Jane Doe");
    expect(savedEducator.email).toBe("jane@example.com");
  });
});
