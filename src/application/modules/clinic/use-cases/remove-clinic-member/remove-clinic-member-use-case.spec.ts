import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ClinicMember } from "../../../../../domain/entities/clinic-member";
import {
  makeClinic,
  makeClinicInviteRepository,
  makeDepartureService,
  makeEducator,
  makeInvite,
  setupClinic,
} from "../test-fixtures";
import { RemoveClinicMemberUseCase } from "./remove-clinic-member-use-case";
import { ClinicDepartureServiceImpl } from "../../../../../infraestructure/services/clinic-departure-service-impl";
import { shareStudent } from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent, setupSharing } from "../../../student/use-cases/test-fixtures";

const setup = (extra: Parameters<typeof setupClinic>[0] = []) => {
  const ctx = setupClinic(extra);
  const departureService = makeDepartureService();
  const inviteRepository = makeClinicInviteRepository();
  const useCase = new RemoveClinicMemberUseCase(
    ctx.clinicRepository,
    ctx.memberRepository,
    inviteRepository,
    departureService
  );
  return { ...ctx, departureService, inviteRepository, useCase };
};

describe("RemoveClinicMemberUseCase", () => {
  it("ADMIN remove um membro e os compartilhamentos dele são desfeitos depois de tirar o vínculo (EQ-09)", async () => {
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
    expect(order).toEqual(["delete", "undoShares"]);
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
    const pro = makeEducator("Paula");
    const { admin, memberRepository, useCase } = setup([
      { educator: other, role: "ADMIN" },
      { educator: pro, role: "PROFESSIONAL" },
    ]);

    const result = await useCase.execute({ educatorId: other.id, targetEducatorId: admin.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(memberRepository.store.has(admin.id.value)).toBe(false);

    // Agora Olga é a única ADMIN e, com Paula na clínica, não pode sair.
    const leave = await useCase.execute({ educatorId: other.id, targetEducatorId: other.id.value });
    expect(leave).toEqual({ ok: false, error: "LAST_ADMIN" });
  });

  it("ADMIN sozinho sai: o vínculo some, os convites ativos são revogados e a clínica é apagada", async () => {
    const { admin, clinic, clinicRepository, memberRepository, inviteRepository, departureService, useCase } =
      setup();
    const invite = makeInvite(clinic, admin.id);
    inviteRepository.store.set(invite.id.value, invite);

    const result = await useCase.execute({ educatorId: admin.id, targetEducatorId: admin.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(memberRepository.store.has(admin.id.value)).toBe(false);
    expect(departureService.undoSharesOf).toHaveBeenCalledWith(clinic.id, admin.id);
    expect(inviteRepository.revokeActive).toHaveBeenCalledWith({ clinicId: clinic.id }, expect.any(Date));
    expect(inviteRepository.store.get(invite.id.value)!.isActive(new Date())).toBe(false);
    expect(clinicRepository.store.has(clinic.id.value)).toBe(false);
  });

  it("ADMIN que sai ou é removido tem os convites ativos que criou revogados, e só esses", async () => {
    const other = makeEducator("Olga");
    const { admin, clinic, clinicRepository, inviteRepository, useCase } = setup([
      { educator: other, role: "ADMIN" },
    ]);
    const mine = makeInvite(clinic, admin.id);
    const theirs = makeInvite(clinic, other.id);
    inviteRepository.store.set(mine.id.value, mine);
    inviteRepository.store.set(theirs.id.value, theirs);

    const result = await useCase.execute({ educatorId: other.id, targetEducatorId: admin.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(inviteRepository.revokeActive).toHaveBeenCalledWith(
      { clinicId: clinic.id, createdBy: admin.id },
      expect.any(Date)
    );
    const now = new Date();
    expect(inviteRepository.store.get(mine.id.value)!.isActive(now)).toBe(false);
    expect(inviteRepository.store.get(theirs.id.value)!.isActive(now)).toBe(true);
    expect(clinicRepository.store.has(clinic.id.value)).toBe(true);
  });

  it("PROFESSIONAL que sai não revoga convites", async () => {
    const pro = makeEducator("Paula");
    const { inviteRepository, useCase } = setup([{ educator: pro, role: "PROFESSIONAL" }]);

    await useCase.execute({ educatorId: pro.id, targetEducatorId: pro.id.value });

    expect(inviteRepository.revokeActive).not.toHaveBeenCalled();
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

  it("remover membro desfaz os compartilhamentos e os pacientes dele continuam com ele (BE-EQ-07)", async () => {
    const ctx = setupSharing();
    const { admin, owner, colleague, student, studentRepository, shareRepository } = ctx;
    const colleagueStudent = makeStudent(colleague.id, "Bruno");
    studentRepository.store.set(colleagueStudent.id.value, colleagueStudent);
    // Do dono para a colega e para o ADMIN; da colega para o dono.
    shareRepository.store.push(
      shareStudent(student, colleague.id),
      shareStudent(student, admin.id),
      shareStudent(colleagueStudent, owner.id)
    );
    const departureService = new ClinicDepartureServiceImpl(studentRepository, shareRepository);
    const useCase = new RemoveClinicMemberUseCase(
      ctx.clinicRepository,
      ctx.memberRepository,
      makeClinicInviteRepository(),
      departureService
    );

    const result = await useCase.execute({ educatorId: admin.id, targetEducatorId: owner.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(ctx.memberRepository.store.has(owner.id.value)).toBe(false);
    // Nenhum compartilhamento com ele ou dele sobra.
    expect(shareRepository.store).toEqual([]);
    // O paciente continua com o dono, e o dono perde o paciente da colega.
    expect((await studentRepository.getById(student.id))?.educatorId.value).toBe(owner.id.value);
    expect(await ctx.studentAccess.assertStudentAccess(student.id, owner.id)).toEqual({
      ok: true,
      value: student,
    });
    expect(await ctx.studentAccess.assertStudentAccess(student.id, colleague.id)).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(await ctx.studentAccess.assertStudentAccess(colleagueStudent.id, owner.id)).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
  });

  it("sair desfaz só os compartilhamentos de quem sai", async () => {
    const ctx = setupSharing();
    const { admin, owner, colleague, student, studentRepository, shareRepository } = ctx;
    const adminStudent = makeStudent(admin.id, "Caio");
    studentRepository.store.set(adminStudent.id.value, adminStudent);
    const kept = shareStudent(adminStudent, owner.id);
    shareRepository.store.push(shareStudent(student, colleague.id), kept);
    const useCase = new RemoveClinicMemberUseCase(
      ctx.clinicRepository,
      ctx.memberRepository,
      makeClinicInviteRepository(),
      new ClinicDepartureServiceImpl(studentRepository, shareRepository)
    );

    const result = await useCase.execute({
      educatorId: colleague.id,
      targetEducatorId: colleague.id.value,
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(shareRepository.store).toEqual([kept]);
  });
});
