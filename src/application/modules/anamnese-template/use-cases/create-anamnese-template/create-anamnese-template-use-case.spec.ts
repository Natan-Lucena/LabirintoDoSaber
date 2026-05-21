import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { CreateAnamneseTemplateUseCase } from "./create-anamnese-template-use-case";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseTemplate, AnamneseQuestionType } from "../../../../../domain/entities/anamnese-template";

const mockTemplateRepository = (): AnamneseTemplateRepository =>
  ({
    save: vi.fn(),
    findById: vi.fn(),
    listByEducatorId: vi.fn(),
    deleteById: vi.fn(),
  } as unknown as AnamneseTemplateRepository);

const validRequest = {
  educatorId: Uuid.random(),
  title: "Anamnese Autismo Infantil",
  description: "Formulário de avaliação inicial",
  questions: [
    {
      text: "A criança apresenta dificuldades na interação social?",
      type: AnamneseQuestionType.MultipleChoice,
      required: true,
      options: [{ text: "Sim" }, { text: "Não" }, { text: "Às vezes" }],
    },
    {
      text: "Descreva o histórico de desenvolvimento da criança.",
      type: AnamneseQuestionType.Descriptive,
      required: false,
    },
  ],
};

describe("CreateAnamneseTemplateUseCase", () => {
  let templateRepository: AnamneseTemplateRepository;
  let useCase: CreateAnamneseTemplateUseCase;

  beforeEach(() => {
    vi.restoreAllMocks();
    templateRepository = mockTemplateRepository();
    useCase = new CreateAnamneseTemplateUseCase(templateRepository);
  });

  it("should create a template successfully", async () => {
    const result = await useCase.execute(validRequest);

    expect(result.ok).toBe(true);
    expect(templateRepository.save).toHaveBeenCalledOnce();

    const saved = (templateRepository.save as any).mock.calls[0][0] as AnamneseTemplate;
    expect(saved.title).toBe(validRequest.title);
    expect(saved.description).toBe(validRequest.description);
    expect(saved.educatorId.value).toBe(validRequest.educatorId.value);
    expect(saved.questions).toHaveLength(2);
    expect(saved.questions[0].id).toBeDefined();
    expect(saved.questions[0].order).toBe(0);
    expect(saved.questions[1].order).toBe(1);
    expect(saved.questions[0].options).toHaveLength(3);
    expect(saved.questions[0].options[0].id).toBeDefined();
  });

  it("should create template without description", async () => {
    const result = await useCase.execute({ ...validRequest, description: undefined });

    expect(result.ok).toBe(true);
    const saved = (templateRepository.save as any).mock.calls[0][0] as AnamneseTemplate;
    expect(saved.description).toBeUndefined();
  });

  it("should create template with empty questions list", async () => {
    const result = await useCase.execute({ ...validRequest, questions: [] });

    expect(result.ok).toBe(true);
    const saved = (templateRepository.save as any).mock.calls[0][0] as AnamneseTemplate;
    expect(saved.questions).toHaveLength(0);
  });

  it("should return failure if AnamneseTemplate.create fails", async () => {
    vi.spyOn(AnamneseTemplate, "create").mockReturnValue(failure(void 0) as any);

    const result = await useCase.execute(validRequest);

    expect(result).toEqual(failure("TEMPLATE_CREATION_FAILED"));
    expect(templateRepository.save).not.toHaveBeenCalled();
  });

  it("should not save if creation fails", async () => {
    vi.spyOn(AnamneseTemplate, "create").mockReturnValue(failure(void 0) as any);

    await useCase.execute(validRequest);

    expect(templateRepository.save).not.toHaveBeenCalled();
  });
});
