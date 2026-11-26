import { describe, it, expect } from "vitest";
import { shortDisplayName } from "../../utils/person-name";

describe("shortDisplayName", () => {
  it("should keep the first name and the initial of the first surname", () => {
    expect(shortDisplayName("Ana Souza Lima")).toBe("Ana S.");
    expect(shortDisplayName("Joaozinho Pereira")).toBe("Joaozinho P.");
  });

  it("should return only the name when there is no surname", () => {
    expect(shortDisplayName("Ana")).toBe("Ana");
  });

  it("should ignore extra spaces", () => {
    expect(shortDisplayName("  Ana   Souza  ")).toBe("Ana S.");
    expect(shortDisplayName("  Ana  ")).toBe("Ana");
  });

  it("should not count the particles de, da, do, dos and das as surname", () => {
    expect(shortDisplayName("Ana de Souza")).toBe("Ana S.");
    expect(shortDisplayName("Ana Da Silva")).toBe("Ana S.");
    expect(shortDisplayName("Pedro dos Santos")).toBe("Pedro S.");
    expect(shortDisplayName("Maria das Dores")).toBe("Maria D.");
    expect(shortDisplayName("Lucas do Carmo Lima")).toBe("Lucas C.");
  });

  it("should return only the name when the rest are particles", () => {
    expect(shortDisplayName("Ana de")).toBe("Ana");
  });

  it("should uppercase the initial and keep accented letters", () => {
    expect(shortDisplayName("ana Ávila")).toBe("ana Á.");
    expect(shortDisplayName("Bia érica")).toBe("Bia É.");
  });
});
