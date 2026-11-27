import { describe, expect, it } from "vitest";
import { ClinicMember } from "../../../../../domain/entities/clinic-member";
import {
  makeClinic,
  makeClinicMemberRepository,
  makeClinicRepository,
  makeEducator,
  makeEducatorRepository,
} from "../test-fixtures";
import { CreateClinicUseCase } from "./create-clinic-use-case";

const setup = (members: ClinicMember[] = [], educator = makeEducator("Carla")) => {
  const clinicRepository = makeClinicRepository();
  const memberRepository = makeClinicMemberRepository(members);
  const educatorRepository = makeEducatorRepository([educator]);
  const useCase = new CreateClinicUseCase(clinicRepository, memberRepository, educatorRepository);
  return { educator, clinicRepository, memberRepository, useCase };
};

describe("CreateClinicUseCase", () => {
  it("cria a clínica e quem cria vira ADMIN (EQ-02)", async () => {
    const { educator, clinicRepository, memberRepository, useCase } = setup();

    const result = await useCase.execute({ educatorId: educator.id, name: " Clínica Aprender " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.clinic.name).toBe("Clínica Aprender");
    expect(result.value.myRole).toBe("ADMIN");
    expect(result.value.members).toHaveLength(1);
    expect(result.value.members[0].educator.id.value).toBe(educator.id.value);
    expect(result.value.members[0].member.role).toBe("ADMIN");
    expect(clinicRepository.store.size).toBe(1);
    expect(memberRepository.store.get(educator.id.value)?.role).toBe("ADMIN");
  });

  it("recusa quem já está numa clínica (EQ-01)", async () => {
    const other = makeClinic("Outra");
    const educator = makeEducator("Carla");
    const { clinicRepository, useCase } = setup(
      [ClinicMember.create({ clinicId: other.id, educatorId: educator.id, role: "PROFESSIONAL" })],
      educator
    );

    const result = await useCase.execute({ educatorId: educator.id, name: "Nova" });

    expect(result).toEqual({ ok: false, error: "ALREADY_IN_CLINIC" });
    expect(clinicRepository.save).not.toHaveBeenCalled();
  });

  it("desfaz a clínica criada se o educador entrou noutra em paralelo (EQ-01)", async () => {
    const { educator, clinicRepository, memberRepository, useCase } = setup();
    // A leitura não viu o vínculo; ele chega antes da gravação.
    memberRepository.findByEducatorId.mockResolvedValueOnce(null);
    memberRepository.store.set(
      educator.id.value,
      ClinicMember.create({ clinicId: makeClinic().id, educatorId: educator.id, role: "ADMIN" })
    );

    const result = await useCase.execute({ educatorId: educator.id, name: "Nova" });

    expect(result).toEqual({ ok: false, error: "ALREADY_IN_CLINIC" });
    expect(clinicRepository.save).toHaveBeenCalledTimes(1);
    expect(clinicRepository.store.size).toBe(0);
  });

  it("recusa nome inválido", async () => {
    const { educator, clinicRepository, useCase } = setup();
    const result = await useCase.execute({ educatorId: educator.id, name: "A" });
    expect(result).toEqual({ ok: false, error: "INVALID_CLINIC_NAME" });
    expect(clinicRepository.save).not.toHaveBeenCalled();
  });
});
