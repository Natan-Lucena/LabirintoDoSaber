import { describe, expect, it } from "vitest";
import { ClinicMember } from "../../../../../domain/entities/clinic-member";
import {
  makeClinic,
  makeClinicInviteRepository,
  makeEducator,
  makeInvite,
  makeRateLimitRepository,
  setupClinic,
  usedInvite,
} from "../test-fixtures";
import { AcceptClinicInviteUseCase } from "./accept-clinic-invite-use-case";

const DAY_MS = 24 * 60 * 60 * 1000;
const IP = "200.1.2.3";

const setup = () => {
  const ctx = setupClinic();
  const newcomer = makeEducator("Nina");
  ctx.educatorRepository.store.set(newcomer.id.value, newcomer);
  const invite = makeInvite(ctx.clinic, ctx.admin.id, { role: "PROFESSIONAL" });
  const inviteRepository = makeClinicInviteRepository([invite]);
  const rateLimitRepository = makeRateLimitRepository();
  const useCase = new AcceptClinicInviteUseCase(
    ctx.clinicRepository,
    ctx.memberRepository,
    inviteRepository,
    ctx.educatorRepository,
    rateLimitRepository
  );
  return { ...ctx, newcomer, invite, inviteRepository, rateLimitRepository, useCase };
};

describe("AcceptClinicInviteUseCase", () => {
  it("entra na clínica com o papel do convite e consome o convite", async () => {
    const { clinic, newcomer, invite, inviteRepository, memberRepository, useCase } = setup();

    const result = await useCase.execute({ ip: IP, educatorId: newcomer.id, code: ` ${invite.code.toLowerCase()} ` });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.clinic.id.value).toBe(clinic.id.value);
    expect(result.value.myRole).toBe("PROFESSIONAL");
    expect(result.value.members.map(({ educator }) => educator.name)).toEqual(["Beatriz", "Nina"]);
    expect(memberRepository.store.get(newcomer.id.value)?.clinicId.value).toBe(clinic.id.value);
    const stored = inviteRepository.store.get(invite.id.value)!;
    expect(stored.usedBy?.value).toBe(newcomer.id.value);
    expect(stored.usedAt).toBeInstanceOf(Date);
  });

  it("BE-EQ-02: código usado, vencido, revogado ou inexistente dão o mesmo 404 INVITE_INVALID", async () => {
    const { admin, clinic, newcomer, inviteRepository, memberRepository, useCase } = setup();
    const expired = makeInvite(clinic, admin.id, { now: new Date(Date.now() - 8 * DAY_MS) });
    const used = usedInvite(makeInvite(clinic, admin.id), makeEducator("Lia").id, new Date());
    const revoked = makeInvite(clinic, admin.id).revoke(new Date());
    for (const invite of [expired, used, revoked]) inviteRepository.store.set(invite.id.value, invite);

    for (const code of [used.code, expired.code, revoked.code, "ZZZZ9999", "abc"]) {
      const result = await useCase.execute({ ip: IP, educatorId: newcomer.id, code });
      expect(result).toEqual({ ok: false, error: "INVITE_INVALID" });
    }
    expect(memberRepository.create).not.toHaveBeenCalled();
    expect(inviteRepository.consume).not.toHaveBeenCalled();
  });

  it("recusa quem já está numa clínica sem consumir o convite (EQ-01)", async () => {
    const { admin, invite, inviteRepository, useCase } = setup();

    const result = await useCase.execute({ ip: IP, educatorId: admin.id, code: invite.code });

    expect(result).toEqual({ ok: false, error: "ALREADY_IN_CLINIC" });
    expect(inviteRepository.consume).not.toHaveBeenCalled();
    expect(inviteRepository.store.get(invite.id.value)!.usedAt).toBeUndefined();
  });

  it("uso único: quando outro aceite consumiu antes, INVITE_INVALID e nenhum membro (EQ-04)", async () => {
    const { newcomer, invite, inviteRepository, memberRepository, useCase } = setup();
    // A leitura viu o convite ativo; outro aceite o consumiu antes da gravação.
    inviteRepository.consume.mockResolvedValueOnce(false);

    const result = await useCase.execute({ ip: IP, educatorId: newcomer.id, code: invite.code });

    expect(result).toEqual({ ok: false, error: "INVITE_INVALID" });
    expect(memberRepository.create).not.toHaveBeenCalled();
  });

  it("dois aceites do mesmo código: só o primeiro entra", async () => {
    const { newcomer, invite, educatorRepository, useCase } = setup();
    const other = makeEducator("Olga");
    educatorRepository.store.set(other.id.value, other);

    const first = await useCase.execute({ ip: IP, educatorId: newcomer.id, code: invite.code });
    const second = await useCase.execute({ ip: IP, educatorId: other.id, code: invite.code });

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, error: "INVITE_INVALID" });
  });

  it("devolve o convite e ALREADY_IN_CLINIC se o educador entrou noutra clínica em paralelo", async () => {
    const { newcomer, invite, inviteRepository, memberRepository, useCase } = setup();
    memberRepository.findByEducatorId.mockResolvedValueOnce(null);
    memberRepository.store.set(
      newcomer.id.value,
      ClinicMember.create({ clinicId: makeClinic("Outra").id, educatorId: newcomer.id, role: "ADMIN" })
    );

    const result = await useCase.execute({ ip: IP, educatorId: newcomer.id, code: invite.code });

    expect(result).toEqual({ ok: false, error: "ALREADY_IN_CLINIC" });
    expect(inviteRepository.release).toHaveBeenCalledWith(invite.id, newcomer.id);
    expect(inviteRepository.store.get(invite.id.value)!.isActive(new Date())).toBe(true);
  });

  it("limita a 10 tentativas por IP a cada 15 minutos, antes de procurar o código", async () => {
    const { newcomer, inviteRepository, rateLimitRepository, useCase } = setup();

    for (let i = 0; i < 10; i++) {
      const result = await useCase.execute({ ip: IP, educatorId: newcomer.id, code: "ZZZZ9999" });
      expect(result).toEqual({ ok: false, error: "INVITE_INVALID" });
    }
    inviteRepository.findByCode.mockClear();

    const blocked = await useCase.execute({ ip: IP, educatorId: newcomer.id, code: "ZZZZ9999" });

    expect(blocked).toEqual({ ok: false, error: "TOO_MANY_REQUESTS" });
    expect(inviteRepository.findByCode).not.toHaveBeenCalled();
    const [key] = rateLimitRepository.tryConsume.mock.calls[0];
    expect(key).toMatch(/^invite-redeem:/);
    expect(key).not.toContain(IP);
  });

  it("IPv6 do mesmo /64 divide a cota", async () => {
    const { newcomer, useCase } = setup();

    for (let i = 1; i <= 10; i++) {
      await useCase.execute({ ip: `2001:db8:1:2::${i}`, educatorId: newcomer.id, code: "ZZZZ9999" });
    }

    const blocked = await useCase.execute({
      ip: "2001:db8:1:2:ffff::1",
      educatorId: newcomer.id,
      code: "ZZZZ9999",
    });
    expect(blocked).toEqual({ ok: false, error: "TOO_MANY_REQUESTS" });
  });
});
