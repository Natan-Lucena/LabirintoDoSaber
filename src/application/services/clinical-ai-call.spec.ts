import { describe, it, expect, vi } from "vitest";
import { AiInvalidOutputError } from "../../domain/services/ai-errors";
import { callClinicalAi, clipAiText } from "./clinical-ai-call";

describe("clipAiText", () => {
  it("keeps texts within the limit, trimmed", () => {
    expect(clipAiText("  curto  ", 10)).toBe("curto");
    expect(clipAiText(undefined, 10)).toBe("");
    expect(clipAiText("   ", 10)).toBe("");
  });

  it("cuts at the last space or line break before the limit", () => {
    expect(clipAiText("uma frase com palavras", 16)).toBe("uma frase com");
    expect(clipAiText("linha um\nlinha dois", 12)).toBe("linha um");
  });

  it("keeps the whole word when the limit falls right before a space", () => {
    expect(clipAiText("uma frase com palavras", 13)).toBe("uma frase com");
  });

  it("cuts at the limit when there is no space", () => {
    expect(clipAiText("s".repeat(20), 10)).toBe("s".repeat(10));
  });
});

describe("callClinicalAi", () => {
  it("converts AiInvalidOutputError and other errors into codes", async () => {
    expect(
      await callClinicalAi("t", () => Promise.reject(new AiInvalidOutputError()))
    ).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await callClinicalAi("t", () => Promise.reject(new Error("dados clínicos")))
    ).toEqual({ ok: false, error: "AI_GENERATION_FAILED" });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("dados clínicos");
    consoleError.mockRestore();
  });
});
