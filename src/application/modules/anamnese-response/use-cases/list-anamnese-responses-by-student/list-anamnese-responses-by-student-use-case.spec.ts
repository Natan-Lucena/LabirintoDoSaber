import { describe, it, expect, vi, beforeEach } from "vitest";
import { success, Uuid } from "@wave-telecom/framework/core";
import { ListAnamneseResponsesByStudentUseCase } from "./list-anamnese-responses-by-student-use-case";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";

const mockResponseRepository = (): AnamneseResponseRepository =>
  ({
    listByStudentId: vi.fn(),
    save: vi.fn(),
    findById: vi.fn(),
    existsByTemplateId: vi.fn(),
  } as unknown as AnamneseResponseRepository);

describe("ListAnamneseResponsesByStudentUseCase", () => {
  let responseRepository: AnamneseResponseRepository;
  let useCase: ListAnamneseResponsesByStudentUseCase;

  beforeEach(() => {
    vi.restoreAllMocks();
    responseRepository = mockResponseRepository();
    useCase = new ListAnamneseResponsesByStudentUseCase(responseRepository);
  });

  it("should return responses for the student", async () => {
    const studentId = Uuid.random();
    const responses = [
      { id: Uuid.random(), templateId: Uuid.random() },
      { id: Uuid.random(), templateId: Uuid.random() },
    ];
    (responseRepository.listByStudentId as any).mockResolvedValue(responses);

    const result = await useCase.execute({ studentId: studentId.value });

    expect(result).toEqual(success(responses));
    expect(responseRepository.listByStudentId).toHaveBeenCalledOnce();
  });

  it("should return empty list when student has no responses", async () => {
    (responseRepository.listByStudentId as any).mockResolvedValue([]);

    const result = await useCase.execute({ studentId: Uuid.random().value });

    expect(result).toEqual(success([]));
  });
});
