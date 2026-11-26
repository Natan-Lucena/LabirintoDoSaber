import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListStudentAnalysisHistoryUseCase } from "./list-student-analysis-history-use-case";
import { StudentAnalysisReportRepository } from "../../../../../domain/repositories/student-analysis-report-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";

describe("ListStudentAnalysisHistoryUseCase", () => {
  const ownerId = Uuid.random();
  const student = makeStudent(ownerId);
  const reports = [{ id: "r1" }];

  let reportRepository: StudentAnalysisReportRepository;
  let studentRepository: StudentRepository;
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let useCase: ListStudentAnalysisHistoryUseCase;

  beforeEach(() => {
    reportRepository = {
      listByStudentId: vi.fn().mockResolvedValue(reports),
    } as unknown as StudentAnalysisReportRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    shareRepository = makeShareRepository();
    useCase = new ListStudentAnalysisHistoryUseCase(
      reportRepository,
      makeStudentAccess(studentRepository, shareRepository)
    );
  });

  it("should list the history for the owner", async () => {
    const result = await useCase.execute({ studentId: student.id.value, educatorId: ownerId });

    expect(result).toEqual({ ok: true, value: reports });
    expect(reportRepository.listByStudentId).toHaveBeenCalledWith(student.id);
  });

  it("EQ-11: should list the history for an educator the student is shared with", async () => {
    const colleagueId = Uuid.random();
    shareRepository.store.push(shareStudent(student, colleagueId));

    const result = await useCase.execute({
      studentId: student.id.value,
      educatorId: colleagueId,
    });

    expect(result).toEqual({ ok: true, value: reports });
  });

  it("should return UNAUTHORIZED for an educator without access", async () => {
    const result = await useCase.execute({
      studentId: student.id.value,
      educatorId: Uuid.random(),
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(reportRepository.listByStudentId).not.toHaveBeenCalled();
  });

  it("should return STUDENT_NOT_FOUND for a missing student", async () => {
    (studentRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      studentId: Uuid.random().value,
      educatorId: ownerId,
    });

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });
});
