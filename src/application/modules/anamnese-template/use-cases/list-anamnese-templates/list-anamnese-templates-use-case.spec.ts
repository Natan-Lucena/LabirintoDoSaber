import { describe, it, expect, vi, beforeEach } from "vitest";
import { success, Uuid } from "@wave-telecom/framework/core";
import { ListAnamneseTemplatesUseCase } from "./list-anamnese-templates-use-case";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";

const mockTemplateRepository = (): AnamneseTemplateRepository =>
  ({
    listByEducatorId: vi.fn(),
    save: vi.fn(),
    findById: vi.fn(),
    deleteById: vi.fn(),
  } as unknown as AnamneseTemplateRepository);

describe("ListAnamneseTemplatesUseCase", () => {
  let templateRepository: AnamneseTemplateRepository;
  let useCase: ListAnamneseTemplatesUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    vi.restoreAllMocks();
    templateRepository = mockTemplateRepository();
    useCase = new ListAnamneseTemplatesUseCase(templateRepository);
  });

  it("should return templates for the educator", async () => {
    const templates = [
      { id: Uuid.random(), title: "Anamnese A" },
      { id: Uuid.random(), title: "Anamnese B" },
    ];
    (templateRepository.listByEducatorId as any).mockResolvedValue(templates);

    const result = await useCase.execute({ educatorId });

    expect(result).toEqual(success(templates));
    expect(templateRepository.listByEducatorId).toHaveBeenCalledWith(educatorId);
  });

  it("should return empty list when educator has no templates", async () => {
    (templateRepository.listByEducatorId as any).mockResolvedValue([]);

    const result = await useCase.execute({ educatorId });

    expect(result).toEqual(success([]));
  });
});
