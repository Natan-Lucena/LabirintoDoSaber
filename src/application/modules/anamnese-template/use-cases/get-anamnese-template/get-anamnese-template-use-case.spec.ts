import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { GetAnamneseTemplateUseCase } from "./get-anamnese-template-use-case";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";

const mockTemplateRepository = (): AnamneseTemplateRepository =>
  ({
    findById: vi.fn(),
    save: vi.fn(),
    listByEducatorId: vi.fn(),
    deleteById: vi.fn(),
  } as unknown as AnamneseTemplateRepository);

const makeTemplate = (educatorId: Uuid) => ({
  id: Uuid.random(),
  educatorId,
  title: "Anamnese",
  description: undefined,
  questions: [],
  createdAt: new Date(),
});

describe("GetAnamneseTemplateUseCase", () => {
  let templateRepository: AnamneseTemplateRepository;
  let useCase: GetAnamneseTemplateUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    vi.restoreAllMocks();
    templateRepository = mockTemplateRepository();
    useCase = new GetAnamneseTemplateUseCase(templateRepository);
  });

  it("should return the template when found and educator is owner", async () => {
    const template = makeTemplate(educatorId);
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
    });

    expect(result.ok).toBe(true);
    expect((result as any).value).toBe(template);
  });

  it("should return failure when template is not found", async () => {
    (templateRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("TEMPLATE_NOT_FOUND"));
  });

  it("should return failure when educator is not the owner", async () => {
    const otherEducatorId = Uuid.random();
    const template = makeTemplate(otherEducatorId);
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("UNAUTHORIZED"));
  });
});
