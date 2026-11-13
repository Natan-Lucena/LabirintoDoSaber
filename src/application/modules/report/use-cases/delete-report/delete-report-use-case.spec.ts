import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Report } from "../../../../../domain/entities/report";
import { DeleteReportUseCase } from "./delete-report-use-case";
import {
  makeReport,
  makeReportRepository,
  makeStudent,
  makeStudentRepository,
} from "../test-fixtures";

describe("DeleteReportUseCase (RP-07)", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let report: Report;
  let reportRepository: ReturnType<typeof makeReportRepository>;
  let useCase: DeleteReportUseCase;

  beforeEach(() => {
    report = makeReport(student);
    reportRepository = makeReportRepository([report]);
    useCase = new DeleteReportUseCase(reportRepository, makeStudentRepository([student]));
  });

  it("should delete the report of the owner", async () => {
    const result = await useCase.execute({ educatorId, reportId: report.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(reportRepository.delete).toHaveBeenCalledWith(report.id);
    expect(reportRepository.store.size).toBe(0);
  });

  it("should return UNAUTHORIZED for another educator", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      reportId: report.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(reportRepository.delete).not.toHaveBeenCalled();
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
    expect(reportRepository.delete).not.toHaveBeenCalled();
  });
});
