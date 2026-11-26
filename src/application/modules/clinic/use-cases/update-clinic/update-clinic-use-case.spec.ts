import { describe, expect, it } from "vitest";
import { makeEducator, setupClinic } from "../test-fixtures";
import { UpdateClinicUseCase } from "./update-clinic-use-case";

describe("UpdateClinicUseCase", () => {
  it("ADMIN renomeia a clínica", async () => {
    const { admin, clinic, clinicRepository, memberRepository, educatorRepository } = setupClinic();
    const useCase = new UpdateClinicUseCase(clinicRepository, memberRepository, educatorRepository);

    const result = await useCase.execute({ educatorId: admin.id, name: "Novo Nome" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.clinic.name).toBe("Novo Nome");
    expect(result.value.myRole).toBe("ADMIN");
    expect(clinicRepository.store.get(clinic.id.value)?.name).toBe("Novo Nome");
  });

  it("PROFESSIONAL recebe FORBIDDEN_ROLE (EQ-03)", async () => {
    const pro = makeEducator("Paula");
    const { clinicRepository, memberRepository, educatorRepository } = setupClinic([
      { educator: pro, role: "PROFESSIONAL" },
    ]);
    const useCase = new UpdateClinicUseCase(clinicRepository, memberRepository, educatorRepository);

    const result = await useCase.execute({ educatorId: pro.id, name: "Novo Nome" });

    expect(result).toEqual({ ok: false, error: "FORBIDDEN_ROLE" });
    expect(clinicRepository.save).not.toHaveBeenCalled();
  });

  it("NOT_IN_CLINIC para quem não tem clínica", async () => {
    const { clinicRepository, memberRepository, educatorRepository } = setupClinic();
    const useCase = new UpdateClinicUseCase(clinicRepository, memberRepository, educatorRepository);

    const result = await useCase.execute({ educatorId: makeEducator("Sem").id, name: "Nome" });

    expect(result).toEqual({ ok: false, error: "NOT_IN_CLINIC" });
  });

  it("recusa nome inválido", async () => {
    const { admin, clinicRepository, memberRepository, educatorRepository } = setupClinic();
    const useCase = new UpdateClinicUseCase(clinicRepository, memberRepository, educatorRepository);

    const result = await useCase.execute({ educatorId: admin.id, name: " " });

    expect(result).toEqual({ ok: false, error: "INVALID_CLINIC_NAME" });
    expect(clinicRepository.save).not.toHaveBeenCalled();
  });
});
