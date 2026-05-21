import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { DeleteAnamneseTemplateUseCase } from "./delete-anamnese-template-use-case";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";

const mockTemplateRepository = (): AnamneseTemplateRepository =>
  ({
    findById: vi.fn(),
    deleteById: vi.fn(),
    save: vi.fn(),
    listByEducatorId: vi.fn(),
  } as unknown as AnamneseTemplateRepository);

const mockResponseRepository = (): AnamneseResponseRepository =>
  ({
    existsByTemplateId: vi.fn(),
    save: vi.fn(),
    findById: vi.fn(),
    listByStudentId: vi.fn(),
  } as unknown as AnamneseResponseRepository);

const makeTemplate = (educatorId: Uuid) => ({
  id: Uuid.random(),
  educatorId,
  title: "Anamnese",
});

describe("DeleteAnamneseTemplateUseCase", () => {
  let templateRepository: AnamneseTemplateRepository;
  let responseRepository: AnamneseResponseRepository;
  let useCase: DeleteAnamneseTemplateUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    vi.restoreAllMocks();
    templateRepository = mockTemplateRepository();
    responseRepository = mockResponseRepository();
    useCase = new DeleteAnamneseTemplateUseCase(templateRepository, responseRepository);

    (responseRepository.existsByTemplateId as any).mockResolvedValue(false);
  });

  it("should delete template successfully", async () => {
    const template = makeTemplate(educatorId);
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(success(null));
    expect(templateRepository.deleteById).toHaveBeenCalledWith(template.id);
  });

  it("should return failure when template is not found", async () => {
    (templateRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("TEMPLATE_NOT_FOUND"));
    expect(templateRepository.deleteById).not.toHaveBeenCalled();
  });

  it("should return failure when educator is not the owner", async () => {
    const template = makeTemplate(Uuid.random());
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("UNAUTHORIZED"));
    expect(templateRepository.deleteById).not.toHaveBeenCalled();
  });

  it("should return failure when template has existing responses", async () => {
    const template = makeTemplate(educatorId);
    (templateRepository.findById as any).mockResolvedValue(template);
    (responseRepository.existsByTemplateId as any).mockResolvedValue(true);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
    });

    expect(result).toEqual(failure("TEMPLATE_HAS_RESPONSES"));
    expect(templateRepository.deleteById).not.toHaveBeenCalled();
  });
});
