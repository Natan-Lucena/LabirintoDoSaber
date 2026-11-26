import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ClinicMember } from "../../../../../domain/entities/clinic-member";
import { makeClinic, makeDepartureService, makeEducator, setupClinic } from "../test-fixtures";
import { RemoveClinicMemberUseCase } from "./remove-clinic-member-use-case";

const setup = (extra: Parameters<typeof setupClinic>[0] = []) => {
  const ctx = setupClinic(extra);
  const departureService = makeDepartureService();
  const useCase = new RemoveClinicMemberUseCase(ctx.memberRepository, departureService);
  return { ...ctx, departureService, useCase };
};

describe("RemoveClinicMemberUseCase", () => {
  it("ADMIN remove um membro e os compartilhamentos dele são desfeitos antes (EQ-09)", async () => {
    const pro = makeEducator("Paula");
    const { admin, clinic, memberRepository, departureService, useCase } = setup([
      { educator: pro, role: "PROFESSIONAL" },
    ]);
    const order: string[] = [];
    departureService.undoSharesOf.mockImplementation(async () => {
      order.push("undoShares");
    });
    memberRepository.deleteByEducatorId.mockImplementation(async (id: Uuid) => {
      order.push("delete");
      memberRepository.store.delete(id.value);
    });

    const result = await useCase.execute({ educatorId: admin.id, targetEducatorId: pro.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(memberRepository.store.has(pro.id.value)).toBe(false);
    expect(departureService.undoSharesOf).toHaveBeenCalledWith(clinic.id, pro.id);
    expect(order).toEqual(["undoShares", "delete"]);
  });

  it("PROFESSIONAL pode sair (o próprio id)", async () => {
    const pro = makeEducator("Paula");
    const { clinic, memberRepository, departureService, useCase } = setup([
      { educator: pro, role: "PROFESSIONAL" },
    ]);

    const result = await useCase.execute({ educatorId: pro.id, targetEducatorId: pro.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(memberRepository.store.has(pro.id.value)).toBe(false);
    expect(departureService.undoSharesOf).toHaveBeenCalledWith(clinic.id, pro.id);
  });

  it("PROFESSIONAL não remove outro membro (FORBIDDEN_ROLE)", async () => {
    const pro = makeEducator("Paula");
    const other = makeEducator("Olga");
    const { memberRepository, departureService, useCase } = setup([
      { educator: pro, role: "PROFESSIONAL" },
      { educator: other, role: "PROFESSIONAL" },
    ]);

    const result = await useCase.execute({ educatorId: pro.id, targetEducatorId: other.id.value });

    expect(result).toEqual({ ok: false, error: "FORBIDDEN_ROLE" });
    expect(memberRepository.deleteByEducatorId).not.toHaveBeenCalled();
    expect(departureService.undoSharesOf).not.toHaveBeenCalled();
  });

  it("BE-EQ-04: o último ADMIN não sai (LAST_ADMIN)", async () => {
    const pro = makeEducator("Paula");
    const { admin, memberRepository, departureService, useCase } = setup([
      { educator: pro, role: "PROFESSIONAL" },
    ]);

    const result = await useCase.execute({ educatorId: admin.id, targetEducatorId: admin.id.value });

    expect(result).toEqual({ ok: false, error: "LAST_ADMIN" });
    expect(memberRepository.deleteByEducatorId).not.toHaveBeenCalled();
    expect(departureService.undoSharesOf).not.toHaveBeenCalled();
  });

  it("com dois ADMIN um remove o outro; o que sobra vira o último e não sai", async () => {
    const other = makeEducator("Olga");
    const { admin, memberRepository, useCase } = setup([{ educator: other, role: "ADMIN" }]);

    const result = await useCase.execute({ educatorId: other.id, targetEducatorId: admin.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(memberRepository.store.has(admin.id.value)).toBe(false);

    // Agora Olga é a única ADMIN e não pode sair.
    const leave = await useCase.execute({ educatorId: other.id, targetEducatorId: other.id.value });
    expect(leave).toEqual({ ok: false, error: "LAST_ADMIN" });
  });

  it("MEMBER_NOT_FOUND para quem não é da clínica ou id não-UUID", async () => {
    const outsider = makeEducator("Fora");
    const { admin, memberRepository, useCase } = setup();
    memberRepository.store.set(
      outsider.id.value,
      ClinicMember.create({ clinicId: makeClinic("Outra").id, educatorId: outsider.id, role: "PROFESSIONAL" })
    );

    for (const targetEducatorId of [outsider.id.value, Uuid.random().value, "nao-e-uuid"]) {
      const result = await useCase.execute({ educatorId: admin.id, targetEducatorId });
      expect(result).toEqual({ ok: false, error: "MEMBER_NOT_FOUND" });
    }
    expect(memberRepository.deleteByEducatorId).not.toHaveBeenCalled();
  });

  it("NOT_IN_CLINIC para quem não tem clínica", async () => {
    const { admin, useCase } = setup();

    const result = await useCase.execute({
      educatorId: makeEducator("Sem").id,
      targetEducatorId: admin.id.value,
    });

    expect(result).toEqual({ ok: false, error: "NOT_IN_CLINIC" });
  });
});
