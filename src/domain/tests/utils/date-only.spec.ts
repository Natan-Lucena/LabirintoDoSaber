import { describe, it, expect } from "vitest";
import {
  addDays,
  addMonths,
  atTimeInSaoPaulo,
  isValidDateOnly,
  timeInSaoPaulo,
  todayInSaoPaulo,
} from "../../utils/date-only";

describe("date-only", () => {
  describe("isValidDateOnly", () => {
    it("should accept a real date in AAAA-MM-DD", () => {
      expect(isValidDateOnly("2026-11-03")).toBe(true);
      expect(isValidDateOnly("2028-02-29")).toBe(true);
    });

    it("should reject dates that do not exist", () => {
      expect(isValidDateOnly("2026-02-30")).toBe(false);
      expect(isValidDateOnly("2026-13-01")).toBe(false);
      expect(isValidDateOnly("2027-02-29")).toBe(false);
    });

    it("should reject other formats", () => {
      expect(isValidDateOnly("03/11/2026")).toBe(false);
      expect(isValidDateOnly("2026-11-03T00:00:00Z")).toBe(false);
      expect(isValidDateOnly("")).toBe(false);
    });
  });

  describe("todayInSaoPaulo", () => {
    it("should use the Sao Paulo calendar day, not UTC", () => {
      // 02:00 UTC ainda é o dia anterior em São Paulo (UTC-3).
      expect(todayInSaoPaulo(new Date("2026-11-04T02:00:00Z"))).toBe(
        "2026-11-03"
      );
    });
  });

  describe("addMonths", () => {
    it("should add months keeping the day", () => {
      expect(addMonths("2026-10-28", 3)).toBe("2027-01-28");
      expect(addMonths("2026-10-28", 6)).toBe("2027-04-28");
    });

    it("should clamp to the last day of the target month", () => {
      expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
      expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
    });
  });

  describe("addDays", () => {
    it("should add days crossing month and year", () => {
      expect(addDays("2026-11-12", 2)).toBe("2026-11-14");
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
      expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    });
  });

  describe("timeInSaoPaulo", () => {
    it("should return the local time of the instant in São Paulo", () => {
      expect(timeInSaoPaulo(new Date("2026-11-26T17:00:00.000Z"))).toBe("14:00:00.000");
      expect(timeInSaoPaulo(new Date("2026-11-27T01:30:00.000Z"))).toBe("22:30:00.000");
      expect(timeInSaoPaulo(new Date("2026-11-26T03:00:00.000Z"))).toBe("00:00:00.000");
    });
  });

  describe("atTimeInSaoPaulo", () => {
    it("should build the instant of a São Paulo date and local time", () => {
      expect(atTimeInSaoPaulo("2026-11-26", "14:00:00.000").toISOString()).toBe(
        "2026-11-26T17:00:00.000Z"
      );
      expect(atTimeInSaoPaulo("2026-11-26", "22:30:00.000").toISOString()).toBe(
        "2026-11-27T01:30:00.000Z"
      );
    });
  });
});
