import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Report, ReportShareChannel } from "../../../../../domain/entities/report";
import { ListReportsUseCase } from "./list-reports-use-case";
import {
  makeReport,
  makeReportRepository,
  makeStudent,
  makeStudentRepository,
} from "../test-fixtures";

describe("ListReportsUseCase", () => {
  const educatorId = Uuid.random();
  const ana = makeStudent(educatorId, "Ana");
  const bia = makeStudent(educatorId, "Bia");
  const other = makeStudent(Uuid.random(), "Caio");

  let anaReport: Report;
  let reportRepository: ReturnType<typeof makeReportRepository>;
  let useCase: ListReportsUseCase;

  beforeEach(() => {
    anaReport = makeReport(ana)
      .share(ReportShareChannel.PRINT, new Date("2026-11-10T10:00:00.000Z"))
      .share(ReportShareChannel.SHARE, new Date("2026-11-11T10:00:00.000Z"));
    reportRepository = makeReportRepository([anaReport, makeReport(bia), makeReport(other)]);
    useCase = new ListReportsUseCase(reportRepository, makeStudentRepository([ana, bia, other]));
  });

  it("should list the reports of the educator's students without the content, with the last share", async () => {
    const result = await useCase.execute({ educatorId, limit: 50 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(reportRepository.search).toHaveBeenCalledWith({
      studentIds: [ana.id, bia.id],
      limit: 50,
    });
    expect(result.value.map((summary) => summary.studentName).sort()).toEqual(["Ana", "Bia"]);
    for (const summary of result.value) {
      expect(summary).not.toHaveProperty("content");
    }
    const anaSummary = result.value.find((summary) => summary.id === anaReport.id.value);
    expect(anaSummary?.lastShare).toEqual({
      channel: ReportShareChannel.SHARE,
      at: new Date("2026-11-11T10:00:00.000Z"),
    });
    expect(anaSummary?.period).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("should filter by an owned student", async () => {
    await useCase.execute({ educatorId, studentId: ana.id.value, limit: 10 });

    expect(reportRepository.search).toHaveBeenCalledWith({ studentIds: [ana.id], limit: 10 });
  });

  it("should return UNAUTHORIZED for a student of another educator", async () => {
    const result = await useCase.execute({ educatorId, studentId: other.id.value, limit: 50 });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(reportRepository.search).not.toHaveBeenCalled();
  });

  it("should return STUDENT_NOT_FOUND for a missing student", async () => {
    const result = await useCase.execute({
      educatorId,
      studentId: Uuid.random().value,
      limit: 50,
    });

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });
});
