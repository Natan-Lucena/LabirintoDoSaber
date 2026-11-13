import { describe, it, expect } from "vitest";
import {
  Report,
  ReportSection,
  ReportType,
} from "../../entities/report";

const request = (overrides: Partial<Parameters<typeof Report.validateRequest>[0]> = {}) => ({
  type: ReportType.PROGRESS,
  sections: [ReportSection.PATIENT_DATA],
  periodFrom: "2026-01-01",
  periodTo: "2026-01-31",
  ...overrides,
});

describe("Report.validateRequest (RP-04)", () => {
  it("should accept a period of up to 365 days, including a single day", () => {
    expect(Report.validateRequest(request()).ok).toBe(true);
    expect(
      Report.validateRequest(request({ periodFrom: "2026-01-01", periodTo: "2026-01-01" })).ok
    ).toBe(true);
    expect(
      Report.validateRequest(request({ periodFrom: "2025-01-01", periodTo: "2026-01-01" })).ok
    ).toBe(true);
  });

  it("should reject an inverted, too long or invalid period", () => {
    for (const [periodFrom, periodTo] of [
      ["2026-02-01", "2026-01-01"],
      ["2025-01-01", "2026-01-02"],
      ["2026-02-30", "2026-03-01"],
    ]) {
      expect(Report.validateRequest(request({ periodFrom, periodTo }))).toEqual({
        ok: false,
        error: "INVALID_PERIOD",
      });
    }
  });

  it("should require at least one section", () => {
    expect(Report.validateRequest(request({ sections: [] }))).toEqual({
      ok: false,
      error: "NO_SECTIONS",
    });
  });

  it("should reject a section not allowed for the type", () => {
    expect(
      Report.validateRequest(
        request({ type: ReportType.PDI_PROGRESS, sections: [ReportSection.SESSION_METRICS] })
      )
    ).toEqual({ ok: false, error: "SECTION_NOT_ALLOWED" });
    expect(
      Report.validateRequest(
        request({ type: ReportType.PROGRESS, sections: [ReportSection.ANAMNESIS_SUMMARY] })
      )
    ).toEqual({ ok: false, error: "SECTION_NOT_ALLOWED" });
  });

  it("should return the sections without repetition, in the order of the type", () => {
    expect(
      Report.validateRequest(
        request({
          type: ReportType.ASSESSMENT,
          sections: [
            ReportSection.AI_SYNTHESIS,
            ReportSection.ASSESSMENTS,
            ReportSection.AI_SYNTHESIS,
          ],
        })
      )
    ).toEqual({ ok: true, value: [ReportSection.ASSESSMENTS, ReportSection.AI_SYNTHESIS] });
  });
});
