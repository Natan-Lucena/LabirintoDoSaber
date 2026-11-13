import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Report } from "../../../../../domain/entities/report";
import { GetReportUseCase } from "./get-report-use-case";
import {
  makeReport,
  makeReportRepository,
  makeStudent,
  makeStudentRepository,
} from "../test-fixtures";

describe("GetReportUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let report: Report;
  let useCase: GetReportUseCase;

  beforeEach(() => {
    report = makeReport(student);
    useCase = new GetReportUseCase(
      makeReportRepository([report]),
      makeStudentRepository([student])
    );
  });

  it("should return the report with its content", async () => {
    const result = await useCase.execute({ educatorId, reportId: report.id.value });

    expect(result).toEqual({ ok: true, value: report });
  });

  it("should return UNAUTHORIZED for a report of another educator's student (BE-RP-06)", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      reportId: report.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return REPORT_NOT_FOUND for a missing report or an invalid id", async () => {
    expect(await useCase.execute({ educatorId, reportId: "x" })).toEqual({
      ok: false,
      error: "REPORT_NOT_FOUND",
    });
    expect(await useCase.execute({ educatorId, reportId: Uuid.random().value })).toEqual({
      ok: false,
      error: "REPORT_NOT_FOUND",
    });
  });
});
