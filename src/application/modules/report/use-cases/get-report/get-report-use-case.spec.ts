import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Report } from "../../../../../domain/entities/report";
import { GetReportUseCase } from "./get-report-use-case";
import {
  makeReport,
  makeReportRepository,
  makeEducator,
  makeEducatorRepository,
  makeStudent,
  makeStudentAccessFor,
  shareStudent,
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
      makeStudentAccessFor([student]),
      makeEducatorRepository()
    );
  });

  it("should return the report with its content", async () => {
    const result = await useCase.execute({ educatorId, reportId: report.id.value });

    expect(result).toEqual({ ok: true, value: { report, authorName: undefined } });
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

  describe("paciente compartilhado (EQ-11, EQ-12)", () => {
    const owner = makeEducator("Marina");
    const colleague = makeEducator("Paula");
    const sharedStudent = makeStudent(owner.id, "Bia");

    it("lets the colleague read the owner's report, with the author name", async () => {
      const ownerReport = makeReport(sharedStudent);
      useCase = new GetReportUseCase(
        makeReportRepository([ownerReport]),
        makeStudentAccessFor([sharedStudent], [shareStudent(sharedStudent, colleague.id)]),
        makeEducatorRepository([owner, colleague])
      );

      const result = await useCase.execute({
        educatorId: colleague.id,
        reportId: ownerReport.id.value,
      });

      expect(result).toEqual({ ok: true, value: { report: ownerReport, authorName: "Marina" } });
    });

    it("omits the author name when the reader is the author", async () => {
      const colleagueReport = makeReport(sharedStudent, { educatorId: colleague.id });
      const educatorRepository = makeEducatorRepository([owner, colleague]);
      useCase = new GetReportUseCase(
        makeReportRepository([colleagueReport]),
        makeStudentAccessFor([sharedStudent], [shareStudent(sharedStudent, colleague.id)]),
        educatorRepository
      );

      const result = await useCase.execute({
        educatorId: colleague.id,
        reportId: colleagueReport.id.value,
      });

      expect(result).toEqual({
        ok: true,
        value: { report: colleagueReport, authorName: undefined },
      });
      expect(educatorRepository.getByIds).not.toHaveBeenCalled();
    });

    it("returns UNAUTHORIZED for a colleague without the share", async () => {
      const ownerReport = makeReport(sharedStudent);
      useCase = new GetReportUseCase(
        makeReportRepository([ownerReport]),
        makeStudentAccessFor([sharedStudent]),
        makeEducatorRepository([owner, colleague])
      );

      const result = await useCase.execute({
        educatorId: colleague.id,
        reportId: ownerReport.id.value,
      });

      expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    });
  });
});
