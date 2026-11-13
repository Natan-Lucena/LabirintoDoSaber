import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GenerateAnamneseSummaryUseCase } from "./generate-anamnese-summary-use-case";
import { UpdateAnamneseResponseUseCase } from "../update-anamnese-response/update-anamnese-response-use-case";
import { AnamneseResponse } from "../../../../../domain/entities/anamnese-response";
import {
  AnamneseQuestionType,
  AnamneseTemplate,
} from "../../../../../domain/entities/anamnese-template";
import { Gender } from "../../../../../domain/entities/student";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { AiInvalidOutputError } from "../../../../../domain/services/ai-plan-generator-service";
import { AiClinicalService } from "../../../../../domain/services/ai-clinical-service";
import { AnamneseContextBuilder } from "../../../../services/anamnese-context-builder";
import { mapAnamneseResponse } from "../../../../../infraestructure/mappers/map-anamnese-response";
import {
  expectNoIdentifiableData,
  makeIdentifiableStudent,
} from "../../../session-evolution/use-cases/test-fixtures";

const FILE_URL = "https://bucket/anamnese-exame-fixture.pdf";

const makeTemplate = (educatorId: Uuid) => {
  const result = AnamneseTemplate.create({
    educatorId,
    title: "Anamnese inicial",
    questions: [
      { text: "Qual a queixa principal?", type: AnamneseQuestionType.Descriptive, required: true },
      {
        text: "Frequenta escola?",
        type: AnamneseQuestionType.MultipleChoice,
        required: false,
        options: [{ text: "Sim" }, { text: "Não" }],
      },
      { text: "Exame anexado", type: AnamneseQuestionType.FileUpload, required: false },
    ],
  });
  if (!result.ok) throw new Error("template");
  return result.value;
};

const unwrap = <T>(result: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!result.ok) throw new Error(`unexpected ${JSON.stringify(result.error)}`);
  return result.value as T;
};

describe("GenerateAnamneseSummaryUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeIdentifiableStudent(educatorId);
  const template = makeTemplate(educatorId);
  const [complaint, school, exam] = template.questions;

  let response: AnamneseResponse;
  let store: Map<string, AnamneseResponse>;
  let responseRepository: AnamneseResponseRepository;
  let templateRepository: AnamneseTemplateRepository;
  let studentRepository: StudentRepository;
  let aiService: AiClinicalService;
  let useCase: GenerateAnamneseSummaryUseCase;

  const aiParams = () => (aiService.anamneseSummary as any).mock.calls[0][0];

  beforeEach(() => {
    response = unwrap<AnamneseResponse>(
      AnamneseResponse.create(
        {
          templateId: template.id,
          educatorId,
          studentId: student.id,
          answers: [
            { questionId: complaint.id, textValue: "Troca letras ao escrever" },
            { questionId: school.id, selectedOptionId: school.options[0].id },
            { questionId: exam.id, fileUrl: FILE_URL },
          ],
          answeredAt: new Date("2026-11-01T12:00:00.000Z"),
        },
        template
      )
    );

    store = new Map([[response.id.value, response]]);
    responseRepository = {
      save: vi.fn(async (saved: AnamneseResponse) => {
        store.set(saved.id.value, saved);
      }),
      findById: vi.fn(async (id: Uuid) => store.get(id.value) ?? null),
      listByStudentId: vi.fn(async () => [...store.values()]),
      existsByTemplateId: vi.fn(),
    };
    templateRepository = {
      findById: vi.fn().mockResolvedValue(template),
    } as unknown as AnamneseTemplateRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    aiService = {
      nextSessionSuggestion: vi.fn(),
      scaleInsight: vi.fn(),
      anamneseSummary: vi.fn().mockResolvedValue({
        text: "- Queixa: trocas de letras na escrita.\n- Escola: frequenta.",
      }),
    };

    useCase = new GenerateAnamneseSummaryUseCase(
      responseRepository,
      templateRepository,
      studentRepository,
      new AnamneseContextBuilder(templateRepository, responseRepository),
      aiService
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const generate = (responseId = response.id.value, requester = educatorId) =>
    useCase.execute({ educatorId: requester, responseId });

  it("generates and persists the summary (AS-01)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-12T15:00:00.000Z"));

    const result = await generate();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.summary).toEqual({
      text: "- Queixa: trocas de letras na escrita.\n- Escola: frequenta.",
      generatedAt: new Date("2026-11-12T15:00:00.000Z"),
    });
    expect(result.value.summaryOutdated).toBe(false);
    expect(result.value.answers).toEqual(response.answers);
    expect(result.value.updatedAt).toBeUndefined();
    expect(responseRepository.save).toHaveBeenCalledWith(result.value);
  });

  it("sends the readable answers, age and gender, without file answers (AS-03)", async () => {
    await generate();

    const params = aiParams();
    expect(params.student).toEqual({ age: 7, gender: Gender.Male });
    expect(params.anamnese).toEqual({
      templateTitle: "Anamnese inicial",
      answers: [
        { question: "Qual a queixa principal?", answer: "Troca letras ao escrever" },
        { question: "Frequenta escola?", answer: "Sim" },
      ],
    });
    const serialized = JSON.stringify(params);
    expect(serialized).not.toContain("Exame anexado");
    expect(serialized).not.toContain("anamnese-exame-fixture");
    expect(serialized).not.toContain("arquivo enviado");
  });

  it("does not send identifiable data of the student to the AI", async () => {
    await generate();

    expectNoIdentifiableData(aiParams());
    expect(JSON.stringify(aiParams())).not.toContain('"name"');
  });

  it("replaces the previous summary when generated again", async () => {
    await generate();
    (aiService.anamneseSummary as any).mockResolvedValue({ text: "Síntese nova." });

    const result = await generate();

    expect(result.ok).toBe(true);
    expect(store.get(response.id.value)?.summary?.text).toBe("Síntese nova.");
  });

  it("marks the summary as outdated after the anamnese is edited (AS-02)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-12T15:00:00.000Z"));
    await generate();

    vi.setSystemTime(new Date("2026-11-12T16:00:00.000Z"));
    const update = new UpdateAnamneseResponseUseCase(templateRepository, responseRepository);
    const updated = await update.execute({
      responseId: response.id.value,
      educatorId,
      answers: [{ questionId: complaint.id, textValue: "Troca letras e omite sílabas" }],
    });
    expect(updated.ok).toBe(true);

    const stored = store.get(response.id.value) as AnamneseResponse;
    expect(stored.summary?.text).toBe(
      "- Queixa: trocas de letras na escrita.\n- Escola: frequenta."
    );
    expect(stored.summaryOutdated).toBe(true);
    expect(mapAnamneseResponse(stored)).toMatchObject({
      summary: { generatedAt: new Date("2026-11-12T15:00:00.000Z") },
      summaryOutdated: true,
    });

    // Gerar de novo deixa a síntese em dia.
    vi.setSystemTime(new Date("2026-11-12T17:00:00.000Z"));
    const regenerated = await generate();
    expect(regenerated.ok && regenerated.value.summaryOutdated).toBe(false);
  });

  it("returns AI_GENERATION_FAILED when the service throws, without saving", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    (aiService.anamneseSummary as any).mockRejectedValue(
      Object.assign(new Error("503 overloaded Troca letras"), { status: 503 })
    );

    const result = await generate();

    expect(result).toEqual({ ok: false, error: "AI_GENERATION_FAILED" });
    expect(responseRepository.save).not.toHaveBeenCalled();
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain("overloaded");
    expect(logged).not.toContain("Troca letras");
    consoleError.mockRestore();
  });

  it("returns AI_INVALID_OUTPUT for AiInvalidOutputError or an empty text", async () => {
    (aiService.anamneseSummary as any).mockRejectedValueOnce(new AiInvalidOutputError());
    expect(await generate()).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });

    (aiService.anamneseSummary as any).mockResolvedValueOnce({ text: "" });
    expect(await generate()).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });

    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it("truncates the summary to 1500 characters", async () => {
    (aiService.anamneseSummary as any).mockResolvedValue({ text: "s".repeat(2000) });

    const result = await generate();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.summary?.text).toHaveLength(1500);
  });

  it("returns NO_ANSWERS_TO_SUMMARIZE when only file answers exist", async () => {
    const onlyFile = unwrap<AnamneseResponse>(
      AnamneseResponse.create(
        {
          templateId: template.id,
          educatorId,
          studentId: student.id,
          answers: [
            { questionId: complaint.id, textValue: "x" },
            { questionId: exam.id, fileUrl: FILE_URL },
          ],
        },
        template
      )
    );
    const fileOnly = AnamneseResponse.fromPersistence({
      id: onlyFile.id,
      templateId: onlyFile.templateId,
      educatorId,
      studentId: student.id,
      answers: onlyFile.answers.filter((a) => a.questionId === exam.id),
      answeredAt: onlyFile.answeredAt,
    });
    store.set(fileOnly.id.value, fileOnly);

    const result = await generate(fileOnly.id.value);

    expect(result).toEqual({ ok: false, error: "NO_ANSWERS_TO_SUMMARIZE" });
    expect(aiService.anamneseSummary).not.toHaveBeenCalled();
  });

  it("returns UNAUTHORIZED for a response of another educator", async () => {
    const result = await generate(response.id.value, Uuid.random());

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(aiService.anamneseSummary).not.toHaveBeenCalled();
  });

  it("returns RESPONSE_NOT_FOUND for an unknown or invalid id", async () => {
    expect(await generate(Uuid.random().value)).toEqual({
      ok: false,
      error: "RESPONSE_NOT_FOUND",
    });
    expect(await generate("nao-e-uuid")).toEqual({
      ok: false,
      error: "RESPONSE_NOT_FOUND",
    });
  });
});
