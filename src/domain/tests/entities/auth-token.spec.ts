import { describe, it, expect, afterEach, vi } from "vitest";
import crypto from "crypto";
import { Uuid } from "@wave-telecom/framework/core";
import { AuthToken } from "../../entities/auth-token";

const MINUTE = 60 * 1000;
const T0 = new Date("2026-11-12T12:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * MINUTE);

function issueAt(now: Date, previous?: AuthToken | null) {
  const result = AuthToken.issue({ userId: Uuid.random(), now, previous });
  if (!result.ok) throw new Error(`issue falhou: ${String(result.error)}`);
  return result.value;
}

function wrongCodeFor(code: string) {
  return code === "000000" ? "111111" : "000000";
}

describe("AuthToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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

    it("não guarda o código em claro", () => {
      const { authToken, code } = issueAt(T0);

      expect(authToken.tokenHash).toBeDefined();
      expect(authToken.tokenHash).not.toContain(code);
    });

    it("código novo invalida o anterior e reaproveita o mesmo registro", () => {
      vi.spyOn(crypto, "randomInt")
        .mockReturnValueOnce(123456 as never)
        .mockReturnValueOnce(654321 as never);
      const first = issueAt(T0);
      const second = issueAt(at(1), first.authToken);

      expect(second.authToken.id.value).toBe(first.authToken.id.value);
      expect(second.authToken.check(first.code, at(2)).result).toEqual({
        ok: false,
        error: "INVALID_TOKEN",
      });
      expect(second.authToken.check(second.code, at(2)).result.ok).toBe(true);
    });

    it("código novo zera tentativas e uso do anterior", () => {
      const first = issueAt(T0);
      const failed = first.authToken.check(wrongCodeFor(first.code), at(1));
      const consumed = failed.authToken.consume(at(1));

      const second = issueAt(at(2), consumed);

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

  describe("check", () => {
    it("aceita o código correto dentro da validade, sem consumir", () => {
      const { authToken, code } = issueAt(T0);

      const checked = authToken.check(code, at(14));

      expect(checked.result).toEqual({ ok: true, value: undefined });
      expect(checked.authToken.consumedAt).toBeUndefined();
      expect(checked.authToken.check(code, at(14)).result.ok).toBe(true);
    });

    it("recusa código vencido com EXPIRED_TOKEN", () => {
      const { authToken, code } = issueAt(T0);

      expect(authToken.check(code, at(16)).result).toEqual({
        ok: false,
        error: "EXPIRED_TOKEN",
      });
    });

    it("código errado devolve INVALID_TOKEN e conta a tentativa", () => {
      const { authToken, code } = issueAt(T0);

      const checked = authToken.check(wrongCodeFor(code), at(1));

      expect(checked.result).toEqual({ ok: false, error: "INVALID_TOKEN" });
      expect(checked.authToken.attempts).toBe(1);
      expect(authToken.attempts).toBe(0);
    });

    it("a 5ª tentativa errada já devolve TOO_MANY_ATTEMPTS", () => {
      const { authToken, code } = issueAt(T0);
      const wrong = wrongCodeFor(code);

      let current = authToken;
      for (let i = 0; i < 4; i++) {
        const checked = current.check(wrong, at(1));
        expect(checked.result).toEqual({ ok: false, error: "INVALID_TOKEN" });
        current = checked.authToken;
      }
      const fifth = current.check(wrong, at(1));

      expect(fifth.result).toEqual({ ok: false, error: "TOO_MANY_ATTEMPTS" });
      expect(fifth.authToken.attempts).toBe(5);
    });

    it("depois de 5 tentativas erradas, nem o código certo vale", () => {
      const { authToken, code } = issueAt(T0);
      const wrong = wrongCodeFor(code);

      let current = authToken;
      for (let i = 0; i < 5; i++) {
        current = current.check(wrong, at(1)).authToken;
      }

      expect(current.check(code, at(1)).result).toEqual({
        ok: false,
        error: "TOO_MANY_ATTEMPTS",
      });
    });

    it("código já usado devolve INVALID_TOKEN (uso único)", () => {
      const { authToken, code } = issueAt(T0);

      const consumed = authToken.consume(at(1));

      expect(consumed.consumedAt).toEqual(at(1));
      expect(consumed.check(code, at(2)).result).toEqual({
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

      expect(legacy.check("123456", T0).result).toEqual({
        ok: false,
        error: "INVALID_TOKEN",
      });
    });
  });
});
