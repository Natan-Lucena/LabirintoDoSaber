import { describe, it, expect, vi, beforeEach } from "vitest";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { GetEducatorProfileUseCase } from "./get-educator-profile-use-case";
import { ClinicMember } from "../../../../../domain/entities/clinic-member";
import {
  makeClinic,
  makeClinicMemberRepository,
  makeClinicRepository,
} from "../../../clinic/use-cases/test-fixtures";


const mockEducatorRepository = (): EducatorRepository => {
  return {
    search: vi.fn(),
    getByEmail: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  } as unknown as EducatorRepository;
};

describe("GetEducatorProfileUseCase", () => {
  let educatorRepository: EducatorRepository;
  let useCase: GetEducatorProfileUseCase;

  beforeEach(() => {
    educatorRepository = mockEducatorRepository();
    useCase = new GetEducatorProfileUseCase(
      educatorRepository,
      makeClinicMemberRepository(),
      makeClinicRepository()
    );
  });

  it("should fail if educator does not exist (empty array)", async () => {
    (educatorRepository.search as any).mockResolvedValue([]);

    const educatorId = Uuid.random(); 
    const result = await useCase.execute({ educatorId }); 

    expect(result).toEqual(failure("EDUCATOR_NOT_FOUND"));
    expect(educatorRepository.search).toHaveBeenCalledWith({ id: educatorId });
  });

  it("should return educator details if educator exists", async () => {
    const educatorId = Uuid.random(); 
    const mockEducator = Educator.create({
      id: educatorId,
      name: "Jane Doe",
      email: "jane@example.com",
      password: "hashed_password_que_nao_sera_retornado",
      createdAt: new Date(),
    });

    (educatorRepository.search as any).mockResolvedValue([mockEducator]);

    const result = await useCase.execute({ educatorId: educatorId }); 

    const expectedDetails = {
      id: educatorId.toString(),
      name: "Jane Doe",
      email: "jane@example.com",
    };

    expect(result).toEqual(success(expectedDetails));
    expect(educatorRepository.search).toHaveBeenCalledWith({ id: educatorId });
    // Sem clínica, o campo fica ausente.
    if (result.ok) expect("clinic" in result.value).toBe(false);
  });

  it("traz clinic { id, name, role } quando o educador é de uma clínica", async () => {
    const educator = Educator.create({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "hash",
    });
    const clinic = makeClinic("Clínica Aprender");
    useCase = new GetEducatorProfileUseCase(
      educatorRepository,
      makeClinicMemberRepository([
        ClinicMember.create({ clinicId: clinic.id, educatorId: educator.id, role: "PROFESSIONAL" }),
      ]),
      makeClinicRepository([clinic])
    );
    (educatorRepository.search as any).mockResolvedValue([educator]);

    const result = await useCase.execute({ educatorId: educator.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.clinic).toEqual({
      id: clinic.id.value,
      name: "Clínica Aprender",
      role: "PROFESSIONAL",
    });
    expect(result.value).not.toHaveProperty("password");
  });

  
});