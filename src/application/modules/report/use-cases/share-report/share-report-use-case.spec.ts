import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Report, ReportShareChannel } from "../../../../../domain/entities/report";
import { ShareReportUseCase } from "./share-report-use-case";
import {
  makeReport,
  makeReportRepository,
  makeStudent,
  makeStudentRepository,
  unwrap,
} from "../test-fixtures";

describe("ShareReportUseCase (RP-08)", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let report: Report;
  let reportRepository: ReturnType<typeof makeReportRepository>;
  let useCase: ShareReportUseCase;

  beforeEach(() => {
    report = makeReport(student);
    reportRepository = makeReportRepository([report]);
    useCase = new ShareReportUseCase(reportRepository, makeStudentRepository([student]));
  });

  it("should record the channel and the date of each share, keeping the content", async () => {
    const before = Date.now();

    const printed = unwrap<Report>(
      await useCase.execute({
        educatorId,
        reportId: report.id.value,
        channel: ReportShareChannel.PRINT,
      })
    );
    const shared = unwrap<Report>(
      await useCase.execute({
        educatorId,
        reportId: report.id.value,
        channel: ReportShareChannel.SHARE,
      })
    );

    expect(printed.shares).toHaveLength(1);
    expect(shared.shares.map((share) => share.channel)).toEqual([
      ReportShareChannel.PRINT,
      ReportShareChannel.SHARE,
    ]);
    for (const share of shared.shares) {
      expect(share.at).toBeInstanceOf(Date);
      expect(share.at.getTime()).toBeGreaterThanOrEqual(before);
    }
    expect(shared.content).toEqual(report.content);
    expect(reportRepository.save).toHaveBeenLastCalledWith(shared);
    // A entidade é imutável: a instância original não muda.
    expect(report.shares).toEqual([]);
  });

  it("should return UNAUTHORIZED for another educator", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      reportId: report.id.value,
      channel: ReportShareChannel.SHARE,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(reportRepository.save).not.toHaveBeenCalled();
  });

  it("should return REPORT_NOT_FOUND for an invalid id", async () => {
    const result = await useCase.execute({
      educatorId,
      reportId: "not-a-uuid",
      channel: ReportShareChannel.SHARE,
    });

    expect(result).toEqual({ ok: false, error: "REPORT_NOT_FOUND" });
  });
});
