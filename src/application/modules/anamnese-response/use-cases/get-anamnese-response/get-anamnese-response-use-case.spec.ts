import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { GetAnamneseResponseUseCase } from "./get-anamnese-response-use-case";
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
    findById: vi.fn(),
    save: vi.fn(),
    listByStudentId: vi.fn(),
    existsByTemplateId: vi.fn(),
  } as unknown as AnamneseResponseRepository);

const makeResponse = (educatorId: Uuid, studentId: Uuid) => ({
  id: Uuid.random(),
  educatorId,
  templateId: Uuid.random(),
  studentId,
  answers: [],
  answeredAt: new Date(),
});

describe("GetAnamneseResponseUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);
  const otherStudent = makeStudent(Uuid.random());

  let responseRepository: AnamneseResponseRepository;
  let useCase: GetAnamneseResponseUseCase;

  const build = (shares: StudentShare[] = []) =>
    new GetAnamneseResponseUseCase(
      responseRepository,
      makeStudentAccess(makeStudentRepositoryFake([student, otherStudent]), shares)
    );

  beforeEach(() => {
    vi.restoreAllMocks();
    responseRepository = mockResponseRepository();
    useCase = build();
  });

  it("should return the response when found and educator is owner of the student", async () => {
    const response = makeResponse(educatorId, student.id);
    (responseRepository.findById as any).mockResolvedValue(response);

    const result = await useCase.execute({
      responseId: Uuid.random().value,
      educatorId,
    });

    expect(result.ok).toBe(true);
    expect((result as any).value).toBe(response);
  });

  it("should return failure when response is not found", async () => {
    (responseRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      responseId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("RESPONSE_NOT_FOUND"));
  });

  it("should return RESPONSE_NOT_FOUND for an id that is not a uuid", async () => {
    const result = await useCase.execute({ responseId: "nao-e-uuid", educatorId });

    expect(result).toEqual(failure("RESPONSE_NOT_FOUND"));
    expect(responseRepository.findById).not.toHaveBeenCalled();
  });

  it("should return failure when the student is of another educator", async () => {
    const response = makeResponse(otherStudent.educatorId, otherStudent.id);
    (responseRepository.findById as any).mockResolvedValue(response);

    const result = await useCase.execute({
      responseId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("UNAUTHORIZED"));
  });

  it("lets a colleague read the response of a shared student written by the owner (EQ-11)", async () => {
    const colleagueId = Uuid.random();
    useCase = build([shareStudent(student, colleagueId)]);
    const response = makeResponse(educatorId, student.id);
    (responseRepository.findById as any).mockResolvedValue(response);

    const result = await useCase.execute({
      responseId: response.id.value,
      educatorId: colleagueId,
    });

    expect(result.ok).toBe(true);
    expect((result as any).value).toBe(response);
  });

  it("lets the owner read a response written by the colleague (access by student)", async () => {
    const response = makeResponse(Uuid.random(), student.id);
    (responseRepository.findById as any).mockResolvedValue(response);

    const result = await useCase.execute({ responseId: response.id.value, educatorId });

    expect(result.ok).toBe(true);
  });
});
