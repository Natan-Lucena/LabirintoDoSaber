import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Report,
  ReportAudience,
  ReportSection,
  ReportType,
} from "../../domain/entities/report";
import { mapReportToResponse, mapReportToSummary } from "./map-report";

const FULL_NAME = "Ana de Souza Lima";

// Como estava gravado antes do PP-06: nome completo também no documento.
const stored = (
  audience: ReportAudience,
  patient: { displayName: string; ageYears: number } | null = {
    displayName: FULL_NAME,
    ageYears: 7,
  }
) =>
  Report.fromPersistence({
    id: Uuid.random(),
    studentId: Uuid.random(),
    studentName: FULL_NAME,
    educatorId: Uuid.random(),
    type: ReportType.PROGRESS,
    audience,
    periodFrom: "2026-11-01",
    periodTo: "2026-11-30",
    sections: [ReportSection.PATIENT_DATA],
    content: {
      title: "Relatório de progresso",
      generatedAt: "2026-11-30T12:00:00.000Z",
      professional: { name: "Marina" },
      ...(patient ? { patient } : {}),
    },
    synthesisFailed: false,
    shares: [],
    createdAt: new Date("2026-11-30T12:00:00.000Z"),
  });

describe("map-report (RP-02)", () => {
  it("should shorten studentName and the stored displayName of a SCHOOL report", () => {
    const json = JSON.stringify(mapReportToResponse(stored(ReportAudience.SCHOOL)));
    const response = JSON.parse(json);

    expect(response.studentName).toBe("Ana S.");
    expect(response.content.patient).toEqual({ displayName: "Ana S.", ageYears: 7 });
    expect(json).not.toContain("Souza");
  });

  it("should keep an already shortened displayName (idempotent)", () => {
    const shortened = stored(ReportAudience.SCHOOL, { displayName: "Ana S.", ageYears: 7 });

    expect(mapReportToResponse(shortened).content.patient?.displayName).toBe("Ana S.");
  });

  it("should shorten studentName in the SCHOOL summary of the history", () => {
    expect(mapReportToSummary(stored(ReportAudience.SCHOOL)).studentName).toBe("Ana S.");
  });

  it("should keep the full name for FAMILY and PROFESSIONAL", () => {
    for (const audience of [ReportAudience.FAMILY, ReportAudience.PROFESSIONAL]) {
      const response = mapReportToResponse(stored(audience));
      expect(response.studentName).toBe(FULL_NAME);
      expect(response.content.patient?.displayName).toBe(FULL_NAME);
      expect(mapReportToSummary(stored(audience)).studentName).toBe(FULL_NAME);
    }
  });

  it("should not add a patient section that was not requested", () => {
    const withoutPatient = stored(ReportAudience.SCHOOL, null);

    expect(mapReportToResponse(withoutPatient).content).not.toHaveProperty("patient");
  });
});
