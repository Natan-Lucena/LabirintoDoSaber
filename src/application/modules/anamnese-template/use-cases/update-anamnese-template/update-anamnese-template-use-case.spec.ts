import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { UpdateAnamneseTemplateUseCase } from "./update-anamnese-template-use-case";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";

const mockTemplateRepository = (): AnamneseTemplateRepository =>
  ({
    findById: vi.fn(),
    save: vi.fn(),
    listByEducatorId: vi.fn(),
    deleteById: vi.fn(),
  } as unknown as AnamneseTemplateRepository);

const mockResponseRepository = (): AnamneseResponseRepository =>
  ({
    existsByTemplateId: vi.fn(),
    save: vi.fn(),
    findById: vi.fn(),
    listByStudentId: vi.fn(),
  } as unknown as AnamneseResponseRepository);

const makeTemplate = (educatorId: Uuid) => {
  const updatedTemplate = { id: Uuid.random(), title: "Updated" };
  return {
    id: Uuid.random(),
    educatorId,
    title: "Anamnese Original",
    questions: [],
    update: vi.fn().mockReturnValue(success(updatedTemplate)),
  };
};

describe("UpdateAnamneseTemplateUseCase", () => {
  let templateRepository: AnamneseTemplateRepository;
  let responseRepository: AnamneseResponseRepository;
  let useCase: UpdateAnamneseTemplateUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    vi.restoreAllMocks();
    templateRepository = mockTemplateRepository();
    responseRepository = mockResponseRepository();
    useCase = new UpdateAnamneseTemplateUseCase(templateRepository, responseRepository);

    (responseRepository.existsByTemplateId as any).mockResolvedValue(false);
  });

  it("should update template successfully when no responses exist", async () => {
    const template = makeTemplate(educatorId);
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
      title: "Novo título",
    });

    expect(result.ok).toBe(true);
    expect(template.update).toHaveBeenCalledWith({ title: "Novo título", description: undefined, questions: undefined });
    expect(templateRepository.save).toHaveBeenCalledOnce();
  });

  it("should return failure when template is not found", async () => {
    (templateRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("TEMPLATE_NOT_FOUND"));
    expect(templateRepository.save).not.toHaveBeenCalled();
  });

  it("should return failure when educator is not the owner", async () => {
    const template = makeTemplate(Uuid.random());
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("UNAUTHORIZED"));
    expect(templateRepository.save).not.toHaveBeenCalled();
  });

  it("should return failure when template already has responses", async () => {
    const template = makeTemplate(educatorId);
    (templateRepository.findById as any).mockResolvedValue(template);
    (responseRepository.existsByTemplateId as any).mockResolvedValue(true);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("TEMPLATE_HAS_RESPONSES"));
    expect(templateRepository.save).not.toHaveBeenCalled();
  });

  it("should return failure when update() returns an error", async () => {
    const template = { ...makeTemplate(educatorId), update: vi.fn().mockReturnValue(failure("INVALID_TEMPLATE_DATA")) };
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
      title: "X",
    });

    expect(result).toEqual(failure("INVALID_TEMPLATE_DATA"));
    expect(templateRepository.save).not.toHaveBeenCalled();
  });
});
