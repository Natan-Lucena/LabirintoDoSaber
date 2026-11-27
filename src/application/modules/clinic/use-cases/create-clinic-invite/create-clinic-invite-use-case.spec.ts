import { describe, expect, it } from "vitest";
import { InviteCodeTakenError } from "../../../../../domain/repositories/clinic-invite-repository";
import { MAX_ACTIVE_INVITES } from "../../../../../domain/entities/clinic-invite";
import {
  makeClinicInviteRepository,
  makeEducator,
  makeInvite,
  setupClinic,
} from "../test-fixtures";
import { CreateClinicInviteUseCase } from "./create-clinic-invite-use-case";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("CreateClinicInviteUseCase", () => {
  it("ADMIN cria convite de 8 caracteres, válido por 7 dias, com o papel pedido (EQ-04)", async () => {
    const { admin, clinic, clinicRepository, memberRepository } = setupClinic();
    const inviteRepository = makeClinicInviteRepository();
    const useCase = new CreateClinicInviteUseCase(clinicRepository, memberRepository, inviteRepository);
    const before = Date.now();

    const result = await useCase.execute({ educatorId: admin.id, role: "PROFESSIONAL" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { invite } = result.value;
    expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(invite.role).toBe("PROFESSIONAL");
    expect(invite.createdBy.value).toBe(admin.id.value);
    expect(invite.clinicId.value).toBe(clinic.id.value);
    expect(invite.expiresAt.getTime() - invite.createdAt.getTime()).toBe(7 * DAY_MS);
    expect(invite.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.value.clinic.id.value).toBe(clinic.id.value);
    expect(inviteRepository.store.size).toBe(1);
  });

  it("BE-EQ-01: PROFESSIONAL criando convite recebe FORBIDDEN_ROLE", async () => {
    const pro = makeEducator("Paula");
    const { clinicRepository, memberRepository } = setupClinic([
      { educator: pro, role: "PROFESSIONAL" },
    ]);
    const inviteRepository = makeClinicInviteRepository();
    const useCase = new CreateClinicInviteUseCase(clinicRepository, memberRepository, inviteRepository);

    const result = await useCase.execute({ educatorId: pro.id, role: "PROFESSIONAL" });

    expect(result).toEqual({ ok: false, error: "FORBIDDEN_ROLE" });
    expect(inviteRepository.create).not.toHaveBeenCalled();
  });

  it("NOT_IN_CLINIC para quem não tem clínica", async () => {
    const { clinicRepository, memberRepository } = setupClinic();
    const useCase = new CreateClinicInviteUseCase(
      clinicRepository,
      memberRepository,
      makeClinicInviteRepository()
    );

    const result = await useCase.execute({ educatorId: makeEducator("Sem").id, role: "ADMIN" });

    expect(result).toEqual({ ok: false, error: "NOT_IN_CLINIC" });
  });

  it("recusa o 21º convite ativo com TOO_MANY_INVITES (EQ-04)", async () => {
    const { admin, clinic, clinicRepository, memberRepository } = setupClinic();
    const active = Array.from({ length: MAX_ACTIVE_INVITES }, () => makeInvite(clinic, admin.id));
    const inviteRepository = makeClinicInviteRepository(active);
    const useCase = new CreateClinicInviteUseCase(clinicRepository, memberRepository, inviteRepository);

    const result = await useCase.execute({ educatorId: admin.id, role: "PROFESSIONAL" });

    expect(MAX_ACTIVE_INVITES).toBe(20);
    expect(result).toEqual({ ok: false, error: "TOO_MANY_INVITES" });
    expect(inviteRepository.create).not.toHaveBeenCalled();
  });

  it("vencidos não contam para o limite", async () => {
    const { admin, clinic, clinicRepository, memberRepository } = setupClinic();
    const old = new Date(Date.now() - 8 * DAY_MS);
    const expired = Array.from({ length: MAX_ACTIVE_INVITES }, () =>
      makeInvite(clinic, admin.id, { now: old })
    );
    const inviteRepository = makeClinicInviteRepository(expired);
    const useCase = new CreateClinicInviteUseCase(clinicRepository, memberRepository, inviteRepository);

    const result = await useCase.execute({ educatorId: admin.id, role: "ADMIN" });

    expect(result.ok).toBe(true);
  });

  it("sorteia outro código quando o sorteado já existe", async () => {
    const { admin, clinicRepository, memberRepository } = setupClinic();
    const inviteRepository = makeClinicInviteRepository();
    inviteRepository.create.mockRejectedValueOnce(new InviteCodeTakenError());
    const useCase = new CreateClinicInviteUseCase(clinicRepository, memberRepository, inviteRepository);

    const result = await useCase.execute({ educatorId: admin.id, role: "PROFESSIONAL" });

    expect(result.ok).toBe(true);
    expect(inviteRepository.create).toHaveBeenCalledTimes(2);
    expect(inviteRepository.store.size).toBe(1);
  });

  it("desiste depois de 5 colisões seguidas com INVITE_CODE_UNAVAILABLE", async () => {
    const { admin, clinicRepository, memberRepository } = setupClinic();
    const inviteRepository = makeClinicInviteRepository();
    inviteRepository.create.mockRejectedValue(new InviteCodeTakenError());
    const useCase = new CreateClinicInviteUseCase(clinicRepository, memberRepository, inviteRepository);

    const result = await useCase.execute({ educatorId: admin.id, role: "PROFESSIONAL" });

    expect(result).toEqual({ ok: false, error: "INVITE_CODE_UNAVAILABLE" });
    expect(inviteRepository.create).toHaveBeenCalledTimes(5);
  });

  it("outros erros do repositório não viram nova tentativa", async () => {
    const { admin, clinicRepository, memberRepository } = setupClinic();
    const inviteRepository = makeClinicInviteRepository();
    inviteRepository.create.mockRejectedValueOnce(new Error("db down"));
    const useCase = new CreateClinicInviteUseCase(clinicRepository, memberRepository, inviteRepository);

    await expect(
      useCase.execute({ educatorId: admin.id, role: "PROFESSIONAL" })
    ).rejects.toThrow("db down");
    expect(inviteRepository.create).toHaveBeenCalledTimes(1);
  });
});
