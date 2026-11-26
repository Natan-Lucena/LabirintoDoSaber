import { describe, expect, it } from "vitest";
import {
  INVITE_PREVIEW_LIMIT,
  PreviewClinicInviteUseCase,
} from "./preview-clinic-invite-use-case";
import {
  makeClinicInviteRepository,
  makeClinicRepository,
  makeEducator,
  makeInvite,
  makeRateLimitRepository,
  setupClinic,
  usedInvite,
} from "../test-fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const setup = () => {
  const { admin, clinic } = setupClinic();
  const clinicRepository = makeClinicRepository([clinic]);
  const invite = makeInvite(clinic, admin.id, { role: "ADMIN" });
  const inviteRepository = makeClinicInviteRepository([invite]);
  const rateLimitRepository = makeRateLimitRepository();
  const useCase = new PreviewClinicInviteUseCase(
    inviteRepository,
    clinicRepository,
    rateLimitRepository
  );
  return { admin, clinic, invite, inviteRepository, rateLimitRepository, useCase };
};

describe("PreviewClinicInviteUseCase", () => {
  it("mostra o nome da clínica, o papel e o vencimento", async () => {
    const { clinic, invite, useCase } = setup();

    const result = await useCase.execute({ code: invite.code.toLowerCase(), ip: "200.1.2.3" });

    expect(result).toEqual({
      ok: true,
      value: { clinicName: clinic.name, role: "ADMIN", expiresAt: invite.expiresAt },
    });
  });

  it("BE-EQ-02: vencido, usado, revogado, inexistente ou malformado dão o mesmo INVITE_INVALID", async () => {
    const { admin, clinic, inviteRepository, useCase } = setup();
    const expired = makeInvite(clinic, admin.id, { now: new Date(Date.now() - 8 * DAY_MS) });
    const used = usedInvite(makeInvite(clinic, admin.id), makeEducator("Lia").id, new Date());
    const revoked = makeInvite(clinic, admin.id).revoke(new Date());
    for (const invite of [expired, used, revoked]) inviteRepository.store.set(invite.id.value, invite);

    for (const code of [expired.code, used.code, revoked.code, "ZZZZ9999", "0OI1"]) {
      const result = await useCase.execute({ code, ip: "200.1.2.3" });
      expect(result).toEqual({ ok: false, error: "INVITE_INVALID" });
    }
  });

  it("limita a 10 consultas por IP a cada 15 minutos (EQ-07)", async () => {
    const { invite, useCase } = setup();
    const now = new Date("2026-11-26T12:00:00Z");

    expect(INVITE_PREVIEW_LIMIT).toBe(10);
    for (let i = 0; i < 10; i++) {
      const result = await useCase.execute({ code: invite.code, ip: "200.1.2.3", now });
      expect(result.ok).toBe(true);
    }

    // Conta também as consultas de códigos inválidos.
    expect(await useCase.execute({ code: invite.code, ip: "200.1.2.3", now })).toEqual({
      ok: false,
      error: "TOO_MANY_REQUESTS",
    });
    expect(await useCase.execute({ code: "ZZZZ9999", ip: "200.1.2.3", now })).toEqual({
      ok: false,
      error: "TOO_MANY_REQUESTS",
    });

    // Outro IP tem a própria cota.
    expect((await useCase.execute({ code: invite.code, ip: "200.9.9.9", now })).ok).toBe(true);

    // Na janela seguinte a cota volta.
    const later = new Date(now.getTime() + 15 * MINUTE_MS);
    expect((await useCase.execute({ code: invite.code, ip: "200.1.2.3", now: later })).ok).toBe(true);
  });

  it("não procura o convite quando o limite foi atingido", async () => {
    const { invite, inviteRepository, rateLimitRepository, useCase } = setup();
    rateLimitRepository.tryConsume.mockResolvedValueOnce(false);

    const result = await useCase.execute({ code: invite.code, ip: "200.1.2.3" });

    expect(result).toEqual({ ok: false, error: "TOO_MANY_REQUESTS" });
    expect(inviteRepository.findByCode).not.toHaveBeenCalled();
  });

  it("guarda o contador sem o IP em claro, com validade no fim da janela", async () => {
    const { invite, rateLimitRepository, useCase } = setup();
    const now = new Date("2026-11-26T12:07:00Z");

    await useCase.execute({ code: invite.code, ip: "200.1.2.3", now });

    const [key, limit, expiresAt] = rateLimitRepository.tryConsume.mock.calls[0];
    expect(key).not.toContain("200.1.2.3");
    expect(limit).toBe(10);
    expect(expiresAt).toEqual(new Date("2026-11-26T12:15:00Z"));
  });
});
