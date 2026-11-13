import { describe, it, expect, afterEach, vi } from "vitest";
import crypto from "crypto";
import { Uuid } from "@wave-telecom/framework/core";
import { AuthToken, AuthTokenProps } from "../../entities/auth-token";

const MINUTE = 60 * 1000;
const T0 = new Date("2026-11-12T12:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * MINUTE);

function issueAt(now: Date, previous?: AuthToken | null) {
  const result = AuthToken.issue({ userId: Uuid.random(), now, previous });
  if (!result.ok) throw new Error(`issue falhou: ${String(result.error)}`);
  return result.value;
}

function withChanges(token: AuthToken, changes: Partial<AuthTokenProps>) {
  return AuthToken.fromPersistence({
    id: token.id,
    userId: token.userId,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
    attempts: token.attempts,
    consumedAt: token.consumedAt,
    sendCount: token.sendCount,
    sendWindowStart: token.sendWindowStart,
    ...changes,
  });
}

function wrongCodeFor(code: string) {
  return code === "000000" ? "111111" : "000000";
}

describe("AuthToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("issue", () => {
    it("gera um código de 6 dígitos válido por 15 minutos, com tentativas zeradas", () => {
      const { authToken, code } = issueAt(T0);

      expect(code).toMatch(/^\d{6}$/);
      expect(authToken.expiresAt).toEqual(at(15));
      expect(authToken.attempts).toBe(0);
      expect(authToken.consumedAt).toBeUndefined();
    });

    it("mantém o zero à esquerda do código", () => {
      vi.spyOn(crypto, "randomInt").mockReturnValueOnce(42 as never);

      const { code } = issueAt(T0);

      expect(code).toBe("000042");
    });

    it("não guarda o código em claro nem um sha256 simples dele", () => {
      const { authToken, code } = issueAt(T0);
      const plainSha = crypto.createHash("sha256").update(code).digest("hex");

      expect(authToken.tokenHash).toBeDefined();
      expect(authToken.tokenHash).not.toContain(code);
      expect(authToken.tokenHash).not.toBe(plainSha);
    });

    it("o hash depende do segredo do servidor", () => {
      vi.spyOn(crypto, "randomInt")
        .mockReturnValueOnce(123456 as never)
        .mockReturnValueOnce(123456 as never);

      vi.stubEnv("PASSWORD_TOKEN_SECRET", "segredo-a");
      const a = issueAt(T0);
      vi.stubEnv("PASSWORD_TOKEN_SECRET", "segredo-b");
      const b = issueAt(T0);

      expect(a.code).toBe(b.code);
      expect(a.authToken.tokenHash).not.toBe(b.authToken.tokenHash);
      expect(b.authToken.check(b.code, at(1)).ok).toBe(true);
      vi.stubEnv("PASSWORD_TOKEN_SECRET", "segredo-a");
      expect(b.authToken.check(b.code, at(1))).toEqual({
        ok: false,
        error: "INVALID_TOKEN",
      });
    });

    it("código novo invalida o anterior e reaproveita o mesmo registro", () => {
      vi.spyOn(crypto, "randomInt")
        .mockReturnValueOnce(123456 as never)
        .mockReturnValueOnce(654321 as never);
      const first = issueAt(T0);
      const second = issueAt(at(1), first.authToken);

      expect(second.authToken.id.value).toBe(first.authToken.id.value);
      expect(second.authToken.check(first.code, at(2))).toEqual({
        ok: false,
        error: "INVALID_TOKEN",
      });
      expect(second.authToken.check(second.code, at(2)).ok).toBe(true);
    });

    it("código novo zera tentativas e uso do anterior", () => {
      const first = issueAt(T0);
      const used = withChanges(first.authToken, {
        attempts: 3,
        consumedAt: at(1),
      });

      const second = issueAt(at(2), used);

      expect(second.authToken.attempts).toBe(0);
      expect(second.authToken.consumedAt).toBeUndefined();
      expect(second.authToken.expiresAt).toEqual(at(17));
    });

    it("permite 3 envios na janela de 15 minutos e recusa o 4º", () => {
      const first = issueAt(T0);
      const second = issueAt(at(1), first.authToken);
      const third = issueAt(at(2), second.authToken);

      const fourth = AuthToken.issue({
        userId: third.authToken.userId,
        now: at(3),
        previous: third.authToken,
      });

      expect(third.authToken.sendCount).toBe(3);
      expect(fourth).toEqual({ ok: false, error: "TOO_MANY_REQUESTS" });
    });

    it("reabre a janela depois de 15 minutos do primeiro envio", () => {
      const first = issueAt(T0);
      const second = issueAt(at(1), first.authToken);
      const third = issueAt(at(2), second.authToken);

      const fourth = AuthToken.issue({
        userId: third.authToken.userId,
        now: at(15),
        previous: third.authToken,
      });

      expect(fourth.ok).toBe(true);
      if (!fourth.ok) return;
      expect(fourth.value.authToken.sendCount).toBe(1);
      expect(fourth.value.authToken.sendWindowStart).toEqual(at(15));
    });
  });

  describe("ensureUsable e check", () => {
    it("aceita o código correto dentro da validade", () => {
      const { authToken, code } = issueAt(T0);

      expect(authToken.ensureUsable(at(14))).toEqual({
        ok: true,
        value: undefined,
      });
      expect(authToken.check(code, at(14))).toEqual({
        ok: true,
        value: undefined,
      });
    });

    it("recusa código vencido com EXPIRED_TOKEN", () => {
      const { authToken, code } = issueAt(T0);

      expect(authToken.ensureUsable(at(16))).toEqual({
        ok: false,
        error: "EXPIRED_TOKEN",
      });
      expect(authToken.check(code, at(16))).toEqual({
        ok: false,
        error: "EXPIRED_TOKEN",
      });
    });

    it("código errado devolve INVALID_TOKEN enquanto restam tentativas", () => {
      const { authToken, code } = issueAt(T0);

      for (const attempts of [0, 1, 2, 3]) {
        expect(
          withChanges(authToken, { attempts }).check(wrongCodeFor(code), at(1))
        ).toEqual({ ok: false, error: "INVALID_TOKEN" });
      }
    });

    it("a 5ª tentativa errada já devolve TOO_MANY_ATTEMPTS", () => {
      const { authToken, code } = issueAt(T0);

      expect(
        withChanges(authToken, { attempts: 4 }).check(wrongCodeFor(code), at(1))
      ).toEqual({ ok: false, error: "TOO_MANY_ATTEMPTS" });
    });

    it("depois de 5 tentativas, nem o código certo vale", () => {
      const { authToken, code } = issueAt(T0);
      const exhausted = withChanges(authToken, { attempts: 5 });

      expect(exhausted.ensureUsable(at(1))).toEqual({
        ok: false,
        error: "TOO_MANY_ATTEMPTS",
      });
      expect(exhausted.check(code, at(1))).toEqual({
        ok: false,
        error: "TOO_MANY_ATTEMPTS",
      });
    });

    it("código já usado devolve INVALID_TOKEN (uso único)", () => {
      const { authToken, code } = issueAt(T0);
      const consumed = withChanges(authToken, { consumedAt: at(1) });

      expect(consumed.check(code, at(2))).toEqual({
        ok: false,
        error: "INVALID_TOKEN",
      });
    });

    it("código usado tem precedência sobre tentativas e validade", () => {
      const { authToken, code } = issueAt(T0);
      const consumed = withChanges(authToken, {
        consumedAt: at(1),
        attempts: 5,
      });

      expect(consumed.check(code, at(30))).toEqual({
        ok: false,
        error: "INVALID_TOKEN",
      });
    });

    it("registro antigo, sem hash ou validade, devolve INVALID_TOKEN", () => {
      const legacy = AuthToken.fromPersistence({
        id: Uuid.random(),
        userId: Uuid.random(),
        attempts: 0,
        sendCount: 0,
      });

      expect(legacy.check("123456", T0)).toEqual({
        ok: false,
        error: "INVALID_TOKEN",
      });
    });
  });
});
