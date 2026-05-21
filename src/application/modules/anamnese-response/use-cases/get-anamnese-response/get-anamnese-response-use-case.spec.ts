import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { GetAnamneseResponseUseCase } from "./get-anamnese-response-use-case";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";

const mockResponseRepository = (): AnamneseResponseRepository =>
  ({
    findById: vi.fn(),
    save: vi.fn(),
    listByStudentId: vi.fn(),
    existsByTemplateId: vi.fn(),
  } as unknown as AnamneseResponseRepository);

const makeResponse = (educatorId: Uuid) => ({
  id: Uuid.random(),
  educatorId,
  templateId: Uuid.random(),
  studentId: Uuid.random(),
  answers: [],
  answeredAt: new Date(),
});

describe("GetAnamneseResponseUseCase", () => {
  let responseRepository: AnamneseResponseRepository;
  let useCase: GetAnamneseResponseUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    vi.restoreAllMocks();
    responseRepository = mockResponseRepository();
    useCase = new GetAnamneseResponseUseCase(responseRepository);
  });

  it("should return the response when found and educator is owner", async () => {
    const response = makeResponse(educatorId);
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

  it("should return failure when educator is not the owner", async () => {
    const response = makeResponse(Uuid.random());
    (responseRepository.findById as any).mockResolvedValue(response);

    const result = await useCase.execute({
      responseId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("UNAUTHORIZED"));
  });
});
