import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  makeClinic,
  makeClinicInviteRepository,
  makeEducator,
  makeInvite,
  setupClinic,
} from "../test-fixtures";
import { RevokeClinicInviteUseCase } from "./revoke-clinic-invite-use-case";

describe("RevokeClinicInviteUseCase", () => {
  it("ADMIN revoga o convite, que deixa de ser ativo", async () => {
    const { admin, clinic, memberRepository } = setupClinic();
    const invite = makeInvite(clinic, admin.id);
    const inviteRepository = makeClinicInviteRepository([invite]);
    const useCase = new RevokeClinicInviteUseCase(memberRepository, inviteRepository);

    const result = await useCase.execute({ educatorId: admin.id, inviteId: invite.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    const stored = inviteRepository.store.get(invite.id.value)!;
    expect(stored.revokedAt).toBeInstanceOf(Date);
    expect(stored.isActive(new Date())).toBe(false);
    // Só o revokedAt muda, pelo método atômico do repositório.
    expect(inviteRepository.revoke).toHaveBeenCalledWith(invite.id, expect.any(Date));
  });

  it("revogar de novo devolve sucesso e mantém a primeira data", async () => {
    const { admin, clinic, memberRepository } = setupClinic();
    const firstRevocation = new Date("2026-11-20T10:00:00Z");
    const invite = makeInvite(clinic, admin.id).revoke(firstRevocation);
    const inviteRepository = makeClinicInviteRepository([invite]);
    const useCase = new RevokeClinicInviteUseCase(memberRepository, inviteRepository);

    const result = await useCase.execute({ educatorId: admin.id, inviteId: invite.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(inviteRepository.store.get(invite.id.value)!.revokedAt).toEqual(firstRevocation);
  });

  it("PROFESSIONAL recebe FORBIDDEN_ROLE (EQ-03)", async () => {
    const pro = makeEducator("Paula");
    const { admin, clinic, memberRepository } = setupClinic([
      { educator: pro, role: "PROFESSIONAL" },
    ]);
    const invite = makeInvite(clinic, admin.id);
    const inviteRepository = makeClinicInviteRepository([invite]);
    const useCase = new RevokeClinicInviteUseCase(memberRepository, inviteRepository);

    const result = await useCase.execute({ educatorId: pro.id, inviteId: invite.id.value });

    expect(result).toEqual({ ok: false, error: "FORBIDDEN_ROLE" });
    expect(inviteRepository.revoke).not.toHaveBeenCalled();
  });

  it("NOT_IN_CLINIC para quem não tem clínica", async () => {
    const { admin, clinic, memberRepository } = setupClinic();
    const invite = makeInvite(clinic, admin.id);
    const useCase = new RevokeClinicInviteUseCase(
      memberRepository,
      makeClinicInviteRepository([invite])
    );

    const result = await useCase.execute({
      educatorId: makeEducator("Sem").id,
      inviteId: invite.id.value,
    });

    expect(result).toEqual({ ok: false, error: "NOT_IN_CLINIC" });
  });

  it("INVITE_NOT_FOUND para convite de outra clínica, inexistente ou id não-UUID", async () => {
    const { admin, memberRepository } = setupClinic();
    const otherInvite = makeInvite(makeClinic("Outra"), makeEducator("Yara").id);
    const inviteRepository = makeClinicInviteRepository([otherInvite]);
    const useCase = new RevokeClinicInviteUseCase(memberRepository, inviteRepository);

    for (const inviteId of [otherInvite.id.value, Uuid.random().value, "nao-e-uuid"]) {
      const result = await useCase.execute({ educatorId: admin.id, inviteId });
      expect(result).toEqual({ ok: false, error: "INVITE_NOT_FOUND" });
    }
    expect(inviteRepository.revoke).not.toHaveBeenCalled();
  });
});
