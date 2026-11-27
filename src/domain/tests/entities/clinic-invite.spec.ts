import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  ClinicInvite,
  generateInviteCode,
  INVITE_CODE_ALPHABET,
  normalizeInviteCode,
} from "../../entities/clinic-invite";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("generateInviteCode", () => {
  it("usa A–Z e 2–9, sem 0, O, 1 nem I", () => {
    expect(INVITE_CODE_ALPHABET).toHaveLength(32);
    for (const forbidden of ["0", "O", "1", "I"]) {
      expect(INVITE_CODE_ALPHABET).not.toContain(forbidden);
    }
  });

  it("gera 8 caracteres do alfabeto", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
  });

  it("sorteia cada posição no alfabeto inteiro", () => {
    const draws = [0, 31, 1, 30, 8, 13, 23, 24];
    let call = 0;
    const code = generateInviteCode((max) => {
      expect(max).toBe(32);
      return draws[call++];
    });
    expect(code).toBe("A9B8JPZ2");
  });
});

describe("normalizeInviteCode", () => {
  it("aceita minúsculas e espaços nas pontas", () => {
    expect(normalizeInviteCode("  abcd2345 ")).toBe("ABCD2345");
  });

  it("recusa o que não tem o formato de um código", () => {
    expect(normalizeInviteCode("ABCD234")).toBeUndefined();
    expect(normalizeInviteCode("ABCD23450")).toBeUndefined();
    expect(normalizeInviteCode("ABCD2340")).toBeUndefined();
    expect(normalizeInviteCode("ABCDO234")).toBeUndefined();
  });
});

describe("ClinicInvite", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const make = () =>
    ClinicInvite.create({
      clinicId: Uuid.random(),
      role: "PROFESSIONAL",
      createdBy: Uuid.random(),
      now,
    });

  it("vale 7 dias e nasce ativo (EQ-04)", () => {
    const invite = make();
    expect(invite.expiresAt.getTime()).toBe(now.getTime() + 7 * DAY_MS);
    expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(invite.isActive(now)).toBe(true);
  });

  it("deixa de ser ativo vencido, usado ou revogado", () => {
    const invite = make();
    expect(invite.isActive(invite.expiresAt)).toBe(false);

    expect(invite.revoke(now).isActive(now)).toBe(false);

    const used = ClinicInvite.fromPersistence({
      id: invite.id,
      clinicId: invite.clinicId,
      code: invite.code,
      role: invite.role,
      createdBy: invite.createdBy,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      usedAt: now,
      usedBy: Uuid.random(),
    });
    expect(used.isActive(now)).toBe(false);
  });

  it("revogar devolve uma instância nova", () => {
    const invite = make();
    const revoked = invite.revoke(now);
    expect(revoked.revokedAt).toEqual(now);
    expect(invite.revokedAt).toBeUndefined();
  });

  it("monta a shareMessage com a data de vencimento em São Paulo (EQ-05)", () => {
    // 03/12 02:30 UTC = 02/12 23:30 em São Paulo.
    const invite = ClinicInvite.create({
      clinicId: Uuid.random(),
      role: "ADMIN",
      createdBy: Uuid.random(),
      now: new Date("2026-11-26T02:30:00Z"),
      code: "ABCD2345",
    });

    expect(invite.shareMessage("Clínica Aprender")).toBe(
      "Use o código ABCD2345 para entrar na equipe Clínica Aprender no app Labirinto do Saber. Vale até 02/12."
    );
  });
});
