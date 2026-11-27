import { describe, it, expect, vi, beforeEach } from "vitest";
import { success, Uuid } from "@wave-telecom/framework/core";
import { ListAnamneseResponsesByStudentUseCase } from "./list-anamnese-responses-by-student-use-case";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { StudentShare } from "../../../../../domain/entities/student-share";
import {
  makeStudentAccess,
  makeStudentRepositoryFake,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";

const mockResponseRepository = (): AnamneseResponseRepository =>
  ({
    listByStudentId: vi.fn(),
    save: vi.fn(),
    findById: vi.fn(),
    existsByTemplateId: vi.fn(),
  } as unknown as AnamneseResponseRepository);

describe("ListAnamneseResponsesByStudentUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let responseRepository: AnamneseResponseRepository;
  let useCase: ListAnamneseResponsesByStudentUseCase;

  const build = (shares: StudentShare[] = []) =>
    new ListAnamneseResponsesByStudentUseCase(
      responseRepository,
      makeStudentAccess(makeStudentRepositoryFake([student]), shares)
    );

  beforeEach(() => {
    vi.restoreAllMocks();
    responseRepository = mockResponseRepository();
    useCase = build();
  });

  it("should return responses for the student", async () => {
    const responses = [
      { id: Uuid.random(), templateId: Uuid.random() },
      { id: Uuid.random(), templateId: Uuid.random() },
    ];
    (responseRepository.listByStudentId as any).mockResolvedValue(responses);

    const result = await useCase.execute({ educatorId, studentId: student.id.value });

    expect(result).toEqual(success(responses));
    expect(responseRepository.listByStudentId).toHaveBeenCalledOnce();
    expect(responseRepository.listByStudentId).toHaveBeenCalledWith(student.id);
  });

  it("should return empty list when student has no responses", async () => {
    (responseRepository.listByStudentId as any).mockResolvedValue([]);

    const result = await useCase.execute({ educatorId, studentId: student.id.value });

    expect(result).toEqual(success([]));
  });

  it("returns UNAUTHORIZED for a student of another educator (RS-08)", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      studentId: student.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(responseRepository.listByStudentId).not.toHaveBeenCalled();
  });

  it("returns STUDENT_NOT_FOUND for a missing student or an invalid id", async () => {
    expect(await useCase.execute({ educatorId, studentId: Uuid.random().value })).toEqual({
      ok: false,
      error: "STUDENT_NOT_FOUND",
    });
    expect(await useCase.execute({ educatorId, studentId: "x" })).toEqual({
      ok: false,
      error: "STUDENT_NOT_FOUND",
    });
  });

  it("lets a colleague list the responses of a shared student (EQ-11)", async () => {
    const colleagueId = Uuid.random();
    useCase = build([shareStudent(student, colleagueId)]);
    (responseRepository.listByStudentId as any).mockResolvedValue([]);

    const result = await useCase.execute({
      educatorId: colleagueId,
      studentId: student.id.value,
    });

    expect(result).toEqual(success([]));
  });
});
