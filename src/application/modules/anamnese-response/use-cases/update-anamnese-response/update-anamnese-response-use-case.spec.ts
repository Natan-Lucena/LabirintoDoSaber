import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UpdateAnamneseResponseUseCase } from "./update-anamnese-response-use-case";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { AnamneseResponse } from "../../../../../domain/entities/anamnese-response";
import {
  AnamneseQuestionType,
  AnamneseTemplate,
} from "../../../../../domain/entities/anamnese-template";

const yesOptionId = Uuid.random().value;
const noOptionId = Uuid.random().value;

const makeTemplate = () =>
  ({
    id: Uuid.random(),
    educatorId: Uuid.random(),
    title: "Anamnese",
    questions: [
      {
        id: "q1",
        text: "Pergunta obrigatória",
        type: AnamneseQuestionType.MultipleChoice,
        required: true,
        order: 0,
        options: [
          { id: yesOptionId, text: "Sim" },
          { id: noOptionId, text: "Não" },
        ],
      },
      {
        id: "q2",
        text: "Pergunta opcional",
        type: AnamneseQuestionType.Descriptive,
        required: false,
        order: 1,
        options: [],
      },
    ],
  }) as unknown as AnamneseTemplate;

const makeResponse = (template: AnamneseTemplate, educatorId: Uuid) => {
  const created = AnamneseResponse.create(
    {
      templateId: template.id,
      educatorId,
      studentId: Uuid.random(),
      answers: [{ questionId: "q1", selectedOptionId: yesOptionId }],
      answeredAt: new Date("2026-01-10T12:00:00.000Z"),
    },
    template
  );
  if (!created.ok) throw new Error("fixture inválida");
  return created.value;
};

describe("UpdateAnamneseResponseUseCase", () => {
  let templateRepository: AnamneseTemplateRepository;
  let responseRepository: AnamneseResponseRepository;
  let useCase: UpdateAnamneseResponseUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    templateRepository = {
      findById: vi.fn(),
    } as unknown as AnamneseTemplateRepository;
    responseRepository = {
      findById: vi.fn(),
      save: vi.fn(),
    } as unknown as AnamneseResponseRepository;
    useCase = new UpdateAnamneseResponseUseCase(
      templateRepository,
      responseRepository
    );
  });

  it("atualiza as respostas do dono, grava updatedAt e preserva answeredAt", async () => {
    const template = makeTemplate();
    const response = makeResponse(template, educatorId);
    (responseRepository.findById as any).mockResolvedValue(response);
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      responseId: response.id.value,
      educatorId,
      answers: [
        { questionId: "q1", selectedOptionId: noOptionId },
        { questionId: "q2", textValue: "Observação nova" },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const updated = result.value;
    expect(updated.id.value).toBe(response.id.value);
    expect(updated.answeredAt).toEqual(new Date("2026-01-10T12:00:00.000Z"));
    expect(updated.updatedAt).toBeInstanceOf(Date);
    expect(updated.answers).toEqual([
      {
        questionId: "q1",
        questionType: AnamneseQuestionType.MultipleChoice,
        selectedOptionId: noOptionId,
      },
      {
        questionId: "q2",
        questionType: AnamneseQuestionType.Descriptive,
        textValue: "Observação nova",
      },
    ]);
    expect(templateRepository.findById).toHaveBeenCalledWith(response.templateId);
    expect(responseRepository.save).toHaveBeenCalledWith(updated);
  });

  it("nega a edição por outro educador", async () => {
    const template = makeTemplate();
    const response = makeResponse(template, Uuid.random());
    (responseRepository.findById as any).mockResolvedValue(response);

    const result = await useCase.execute({
      responseId: response.id.value,
      educatorId,
      answers: [{ questionId: "q1", selectedOptionId: noOptionId }],
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it("recusa respostas sem a pergunta obrigatória", async () => {
    const template = makeTemplate();
    const response = makeResponse(template, educatorId);
    (responseRepository.findById as any).mockResolvedValue(response);
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      responseId: response.id.value,
      educatorId,
      answers: [{ questionId: "q2", textValue: "Só a opcional" }],
    });

    expect(result).toEqual({ ok: false, error: "MISSING_REQUIRED_ANSWER" });
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it("recusa opção que não existe na pergunta", async () => {
    const template = makeTemplate();
    const response = makeResponse(template, educatorId);
    (responseRepository.findById as any).mockResolvedValue(response);
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      responseId: response.id.value,
      educatorId,
      answers: [{ questionId: "q1", selectedOptionId: Uuid.random().value }],
    });

    expect(result).toEqual({ ok: false, error: "INVALID_OPTION_ID" });
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it("devolve RESPONSE_NOT_FOUND quando a resposta não existe", async () => {
    (responseRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      responseId: Uuid.random().value,
      educatorId,
      answers: [],
    });

    expect(result).toEqual({ ok: false, error: "RESPONSE_NOT_FOUND" });
  });

  it("devolve RESPONSE_NOT_FOUND para id inválido sem consultar o banco", async () => {
    const result = await useCase.execute({
      responseId: "nao-e-uuid",
      educatorId,
      answers: [],
    });

    expect(result).toEqual({ ok: false, error: "RESPONSE_NOT_FOUND" });
    expect(responseRepository.findById).not.toHaveBeenCalled();
  });
});
