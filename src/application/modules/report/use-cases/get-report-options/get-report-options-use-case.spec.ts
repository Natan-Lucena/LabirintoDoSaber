import { describe, it, expect } from "vitest";
import {
  ReportAudience,
  ReportSection,
  ReportType,
} from "../../../../../domain/entities/report";
import { GetReportOptionsUseCase } from "./get-report-options-use-case";

describe("GetReportOptionsUseCase (BE-RP-01)", () => {
  const options = (() => {
    const result = new GetReportOptionsUseCase().execute();
    if (!result.ok) throw new Error("unexpected failure");
    return result.value;
  })();

  it("should list the three types with their allowed and default sections", () => {
    expect(options.types.map((type) => type.type)).toEqual([
      ReportType.PROGRESS,
      ReportType.ASSESSMENT,
      ReportType.PDI_PROGRESS,
    ]);

    const byType = Object.fromEntries(options.types.map((type) => [type.type, type]));
    expect(byType[ReportType.PROGRESS].allowedSections).toEqual([
      ReportSection.PATIENT_DATA,
      ReportSection.SESSION_METRICS,
      ReportSection.EVOLUTIONS,
      ReportSection.PLAN_PROGRESS,
      ReportSection.AI_SYNTHESIS,
    ]);
    expect(byType[ReportType.ASSESSMENT].allowedSections).toEqual([
      ReportSection.PATIENT_DATA,
      ReportSection.ASSESSMENTS,
      ReportSection.ANAMNESIS_SUMMARY,
      ReportSection.AI_SYNTHESIS,
    ]);
    expect(byType[ReportType.PDI_PROGRESS].allowedSections).toEqual([
      ReportSection.PATIENT_DATA,
      ReportSection.PLAN_PROGRESS,
      ReportSection.EVOLUTIONS,
      ReportSection.AI_SYNTHESIS,
    ]);
    for (const type of options.types) {
      expect(type.defaultSections).toEqual(type.allowedSections);
      expect(type.label).not.toBe("");
      expect(type.description).not.toBe("");
    }
  });

  it("should mark only assessments and anamnese summary as sensitive (RP-01)", () => {
    expect(options.sections).toHaveLength(7);
    const sensitive = options.sections
      .filter((section) => section.sensitive)
      .map((section) => section.section);
    expect(sensitive).toEqual([ReportSection.ASSESSMENTS, ReportSection.ANAMNESIS_SUMMARY]);
  });

  it("should list the audiences, the 30/90/180-day periods and the 365-day limit", () => {
    expect(options.audiences.map((audience) => audience.audience)).toEqual([
      ReportAudience.FAMILY,
      ReportAudience.SCHOOL,
      ReportAudience.PROFESSIONAL,
    ]);
    expect(options.periods.map((period) => period.days)).toEqual([30, 90, 180]);
    expect(options.maxPeriodDays).toBe(365);
  });
});
