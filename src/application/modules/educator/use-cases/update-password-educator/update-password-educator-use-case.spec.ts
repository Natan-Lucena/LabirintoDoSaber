import { describe, it, expect, vi, beforeEach } from "vitest";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { UpdatePasswordEducatorUseCase } from "./update-password-educator-use-case";
import { success, failure } from "@wave-telecom/framework/core";

const mockEducatorRepository = (): EducatorRepository => {
  return {
    getByEmail: vi.fn(),
    save: vi.fn(),
  } as unknown as EducatorRepository;
};

describe("UpdatePasswordEducatorUseCase", () => {
  let educatorRepository: EducatorRepository;
  let useCase: UpdatePasswordEducatorUseCase;
  let educator: Educator;

  beforeEach(() => {
    educatorRepository = mockEducatorRepository();
    useCase = new UpdatePasswordEducatorUseCase(educatorRepository);

    educator = Educator.create({
      name: "John Doe",
      email: "john@example.com",
      password: "oldHashPassword",
    });
    educator.updatePassword = vi.fn();
  });

  it("should fail if educator does not exist", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue(null);

    const result = await useCase.execute({
      email: "notfound@example.com",
      newPassword: "newpassword123",
    });

    expect(result).toEqual(failure("EDUCATOR_NOT_FOUND"));
    expect(educatorRepository.save).not.toHaveBeenCalled();
  });

  it("should update password successfully", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue(educator);

    const result = await useCase.execute({
      email: "john@example.com",
      newPassword: "newpassword123",
    });

    expect(result).toEqual(success(void 0));
    expect(educator.updatePassword).toHaveBeenCalled();
    expect(educatorRepository.save).toHaveBeenCalledWith(educator);
  });
});
