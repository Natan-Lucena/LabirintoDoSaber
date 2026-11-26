import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  AppointmentSeries,
  RecurrenceFrequency,
} from "../../entities/appointment-series";
import { dateInSaoPaulo, timeInSaoPaulo } from "../../utils/date-only";

type CreateProps = Parameters<typeof AppointmentSeries.create>[0];

const makeProps = (overrides: Partial<CreateProps> = {}): CreateProps => ({
  educatorId: Uuid.random(),
  studentId: Uuid.random(),
  frequency: RecurrenceFrequency.WEEKLY,
  // Quinta-feira, 14:00 em São Paulo.
  firstScheduledAt: new Date("2026-12-17T17:00:00.000Z"),
  occurrences: 8,
  ...overrides,
});

const createOk = (overrides: Partial<CreateProps> = {}) => {
  const result = AppointmentSeries.create(makeProps(overrides));
  if (!result.ok) throw new Error(`unexpected failure: ${result.error}`);
  return result.value;
};

const weekdayInSaoPaulo = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "long" }).format(
    date
  );

describe("AppointmentSeries", () => {
  describe("create", () => {
    it("should keep the props and default the duration to 50 minutes", () => {
      const series = createOk({ type: "Sessão", observation: "Trazer o caderno" });

      expect(series.frequency).toBe(RecurrenceFrequency.WEEKLY);
      expect(series.occurrences).toBe(8);
      expect(series.durationMinutes).toBe(50);
      expect(series.type).toBe("Sessão");
      expect(series.observation).toBe("Trazer o caderno");
      expect(series.endedAt).toBeUndefined();
      expect(series.isEnded).toBe(false);
    });

    it("should reject fewer than 2 or more than 26 occurrences", () => {
      expect(AppointmentSeries.create(makeProps({ occurrences: 1 }))).toEqual({
        ok: false,
        error: "INVALID_OCCURRENCES",
      });
      expect(AppointmentSeries.create(makeProps({ occurrences: 27 }))).toEqual({
        ok: false,
        error: "INVALID_OCCURRENCES",
      });
    });

    it("should accept 26 weekly occurrences (about 6 months)", () => {
      expect(AppointmentSeries.create(makeProps({ occurrences: 26 })).ok).toBe(true);
    });

    it("should accept 13 biweekly occurrences and reject 14 (more than 6 months)", () => {
      const biweekly = { frequency: RecurrenceFrequency.BIWEEKLY };

      expect(AppointmentSeries.create(makeProps({ ...biweekly, occurrences: 13 })).ok).toBe(true);
      expect(AppointmentSeries.create(makeProps({ ...biweekly, occurrences: 14 }))).toEqual({
        ok: false,
        error: "SERIES_TOO_LONG",
      });
    });
  });

  describe("occurrenceDates", () => {
    // BE-RC-03
    it("should put every weekly occurrence at 14:00 in São Paulo, crossing months and years", () => {
      const dates = createOk().occurrenceDates();

      expect(dates).toHaveLength(8);
      for (const date of dates) {
        expect(timeInSaoPaulo(date)).toBe("14:00:00.000");
        expect(weekdayInSaoPaulo(date)).toBe("Thursday");
      }
      expect(dates.map(dateInSaoPaulo)).toEqual([
        "2026-12-17",
        "2026-12-24",
        "2026-12-31",
        "2027-01-07",
        "2027-01-14",
        "2027-01-21",
        "2027-01-28",
        "2027-02-04",
      ]);
    });

    it("should follow the São Paulo calendar when the local time is late at night", () => {
      // Domingo, 22:30 em São Paulo, que já é segunda-feira em UTC.
      const dates = createOk({
        firstScheduledAt: new Date("2026-11-30T01:30:00.000Z"),
        occurrences: 3,
      }).occurrenceDates();

      expect(dates.map(dateInSaoPaulo)).toEqual(["2026-11-29", "2026-12-06", "2026-12-13"]);
      expect(dates.map((date) => date.toISOString())).toEqual([
        "2026-11-30T01:30:00.000Z",
        "2026-12-07T01:30:00.000Z",
        "2026-12-14T01:30:00.000Z",
      ]);
    });

    it("should space biweekly occurrences 14 days apart at the same local time", () => {
      const dates = createOk({
        frequency: RecurrenceFrequency.BIWEEKLY,
        occurrences: 4,
      }).occurrenceDates();

      expect(dates.map(dateInSaoPaulo)).toEqual([
        "2026-12-17",
        "2026-12-31",
        "2027-01-14",
        "2027-01-28",
      ]);
      for (const date of dates) {
        expect(timeInSaoPaulo(date)).toBe("14:00:00.000");
      }
    });
  });

  describe("end", () => {
    it("should return a new ended series and keep the first end date", () => {
      const series = createOk();
      const firstEnd = new Date("2027-01-10T12:00:00.000Z");

      const ended = series.end(firstEnd);
      const endedAgain = ended.end(new Date("2027-01-20T12:00:00.000Z"));

      expect(series.endedAt).toBeUndefined();
      expect(ended.isEnded).toBe(true);
      expect(ended.endedAt).toEqual(firstEnd);
      expect(endedAgain.endedAt).toEqual(firstEnd);
      expect(ended.id.value).toBe(series.id.value);
    });
  });
});
