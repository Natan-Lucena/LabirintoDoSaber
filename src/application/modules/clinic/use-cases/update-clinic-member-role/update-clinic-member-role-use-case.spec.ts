import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ClinicMember } from "../../../../../domain/entities/clinic-member";
import {
  makeClinic,
  makeClinicInviteRepository,
  makeEducator,
  makeInvite,
  setupClinic,
} from "../test-fixtures";
import { UpdateClinicMemberRoleUseCase } from "./update-clinic-member-role-use-case";

const setup = (extra: Parameters<typeof setupClinic>[0] = []) => {
  const ctx = setupClinic(extra);
  const inviteRepository = makeClinicInviteRepository();
  const useCase = new UpdateClinicMemberRoleUseCase(
    ctx.clinicRepository,
    ctx.memberRepository,
    inviteRepository,
    ctx.educatorRepository
  );
  return { ...ctx, inviteRepository, useCase };
};

describe("UpdateClinicMemberRoleUseCase", () => {
  it("ADMIN promove um PROFESSIONAL", async () => {
    const pro = makeEducator("Paula");
    const { admin, memberRepository, useCase } = setup([{ educator: pro, role: "PROFESSIONAL" }]);

    const result = await useCase.execute({
      educatorId: admin.id,
      targetEducatorId: pro.id.value,
      role: "ADMIN",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(memberRepository.store.get(pro.id.value)?.role).toBe("ADMIN");
    expect(result.value.members.every(({ member }) => member.role === "ADMIN")).toBe(true);
  });

  it("rebaixa um ADMIN quando há outro ADMIN", async () => {
    const other = makeEducator("Olga");
    const { admin, memberRepository, useCase } = setup([{ educator: other, role: "ADMIN" }]);

    const result = await useCase.execute({
      educatorId: admin.id,
      targetEducatorId: admin.id.value,
      role: "PROFESSIONAL",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.myRole).toBe("PROFESSIONAL");
    expect(memberRepository.store.get(admin.id.value)?.role).toBe("PROFESSIONAL");
  });

  it("rebaixar um ADMIN revoga os convites ativos que ele criou, e só esses", async () => {
    const other = makeEducator("Olga");
    const { admin, clinic, inviteRepository, useCase } = setup([{ educator: other, role: "ADMIN" }]);
    const mine = makeInvite(clinic, admin.id);
    const theirs = makeInvite(clinic, other.id);
    inviteRepository.store.set(mine.id.value, mine);
    inviteRepository.store.set(theirs.id.value, theirs);

    const result = await useCase.execute({
      educatorId: other.id,
      targetEducatorId: admin.id.value,
      role: "PROFESSIONAL",
    });

    expect(result.ok).toBe(true);
    expect(inviteRepository.revokeActive).toHaveBeenCalledWith(
      { clinicId: clinic.id, createdBy: admin.id },
      expect.any(Date)
    );
    const now = new Date();
    expect(inviteRepository.store.get(mine.id.value)!.isActive(now)).toBe(false);
    expect(inviteRepository.store.get(theirs.id.value)!.isActive(now)).toBe(true);
  });

  it("promover não revoga convites", async () => {
    const pro = makeEducator("Paula");
    const { admin, inviteRepository, useCase } = setup([{ educator: pro, role: "PROFESSIONAL" }]);

    await useCase.execute({ educatorId: admin.id, targetEducatorId: pro.id.value, role: "ADMIN" });

    expect(inviteRepository.revokeActive).not.toHaveBeenCalled();
  });

  it("BE-EQ-04: o último ADMIN não vira PROFESSIONAL (LAST_ADMIN)", async () => {
    const pro = makeEducator("Paula");
    const { admin, memberRepository, useCase } = setup([{ educator: pro, role: "PROFESSIONAL" }]);

    const result = await useCase.execute({
      educatorId: admin.id,
      targetEducatorId: admin.id.value,
      role: "PROFESSIONAL",
    });

    expect(result).toEqual({ ok: false, error: "LAST_ADMIN" });
    expect(memberRepository.save).not.toHaveBeenCalled();
  });

  it("PROFESSIONAL recebe FORBIDDEN_ROLE (EQ-03)", async () => {
    const pro = makeEducator("Paula");
    const { admin, memberRepository, useCase } = setup([{ educator: pro, role: "PROFESSIONAL" }]);

    const result = await useCase.execute({
      educatorId: pro.id,
      targetEducatorId: admin.id.value,
      role: "PROFESSIONAL",
    });

    expect(result).toEqual({ ok: false, error: "FORBIDDEN_ROLE" });
    expect(memberRepository.save).not.toHaveBeenCalled();
  });

  it("MEMBER_NOT_FOUND para quem não é da clínica ou id não-UUID", async () => {
    const outsider = makeEducator("Fora");
    const { admin, memberRepository, useCase } = setup();
    memberRepository.store.set(
      outsider.id.value,
      ClinicMember.create({ clinicId: makeClinic("Outra").id, educatorId: outsider.id, role: "PROFESSIONAL" })
    );

    for (const targetEducatorId of [outsider.id.value, Uuid.random().value, "nao-e-uuid"]) {
      const result = await useCase.execute({ educatorId: admin.id, targetEducatorId, role: "ADMIN" });
      expect(result).toEqual({ ok: false, error: "MEMBER_NOT_FOUND" });
    }
    expect(memberRepository.save).not.toHaveBeenCalled();
  });

  it("NOT_IN_CLINIC para quem não tem clínica", async () => {
    const { admin, useCase } = setup();

    const result = await useCase.execute({
      educatorId: makeEducator("Sem").id,
      targetEducatorId: admin.id.value,
      role: "PROFESSIONAL",
    });

    expect(result).toEqual({ ok: false, error: "NOT_IN_CLINIC" });
  });
});
