import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { SaveStudentAnalysisSnapshotUseCase } from "./save-student-analysis-snapshot-use-case";
import { GenerateStudentAnalysisUseCase } from "../generate-student-analisys/generate-student-analisys-use-case";
import { StudentAnalysisReportRepository } from "../../../../../domain/repositories/student-analysis-report-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";

describe("SaveStudentAnalysisSnapshotUseCase", () => {
  const ownerId = Uuid.random();
  const student = makeStudent(ownerId);

  let reportRepository: StudentAnalysisReportRepository;
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let useCase: SaveStudentAnalysisSnapshotUseCase;

  beforeEach(() => {
    const studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    shareRepository = makeShareRepository();
    const analysis = new GenerateStudentAnalysisUseCase(
      studentRepository,
      { listByStudentId: vi.fn().mockResolvedValue([]) } as unknown as TaskNotebookSessionRepository,
      { getByIds: vi.fn().mockResolvedValue([]) } as unknown as TaskRepository,
      makeStudentAccess(studentRepository, shareRepository)
    );
    reportRepository = {
      save: vi.fn(),
    } as unknown as StudentAnalysisReportRepository;
    useCase = new SaveStudentAnalysisSnapshotUseCase(analysis, reportRepository);
  });

  it("EQ-11: should save the snapshot for an educator the student is shared with", async () => {
    const colleagueId = Uuid.random();
    shareRepository.store.push(shareStudent(student, colleagueId));

    const result = await useCase.execute({
      studentId: student.id.value,
      educatorId: colleagueId,
    });

    expect(result.ok).toBe(true);
    expect(reportRepository.save).toHaveBeenCalledTimes(1);
  });

  it("should return UNAUTHORIZED and save nothing for an educator without access", async () => {
    const result = await useCase.execute({
      studentId: student.id.value,
      educatorId: Uuid.random(),
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(reportRepository.save).not.toHaveBeenCalled();
  });
});
