import { describe, expect, it } from "vitest";
import { makeEducator, setupClinic } from "../test-fixtures";
import { GetClinicUseCase } from "./get-clinic-use-case";

describe("GetClinicUseCase", () => {
  it("devolve a clínica, o meu papel e os membros com ADMIN primeiro e depois por nome", async () => {
    const zelia = makeEducator("Zélia");
    const ana = makeEducator("Ana");
    const bruno = makeEducator("Bruno");
    const { clinic, clinicRepository, memberRepository, educatorRepository } = setupClinic(
      [
        { educator: zelia, role: "ADMIN" },
        { educator: bruno, role: "PROFESSIONAL" },
        { educator: ana, role: "PROFESSIONAL" },
      ],
      "Marta"
    );
    const useCase = new GetClinicUseCase(clinicRepository, memberRepository, educatorRepository);

    const result = await useCase.execute({ educatorId: bruno.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.clinic.id.value).toBe(clinic.id.value);
    expect(result.value.myRole).toBe("PROFESSIONAL");
    expect(result.value.members.map(({ educator }) => educator.name)).toEqual([
      "Marta",
      "Zélia",
      "Ana",
      "Bruno",
    ]);
    // Educadores numa busca só, sem N+1.
    expect(educatorRepository.getByIds).toHaveBeenCalledTimes(1);
  });

  it("NOT_IN_CLINIC para quem não tem clínica", async () => {
    const { clinicRepository, memberRepository, educatorRepository } = setupClinic();
    const useCase = new GetClinicUseCase(clinicRepository, memberRepository, educatorRepository);

    const result = await useCase.execute({ educatorId: makeEducator("Sem").id });

    expect(result).toEqual({ ok: false, error: "NOT_IN_CLINIC" });
  });
});
