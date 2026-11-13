import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  ApplicationStatus,
  ScaleApplication,
} from "../../../../../domain/entities/scale-application";
import { Gender } from "../../../../../domain/entities/student";
import { AiInvalidOutputError } from "../../../../../domain/services/ai-plan-generator-service";
import { AiClinicalService } from "../../../../../domain/services/ai-clinical-service";
import { GenerateInsightUseCase } from "./generate-insight-use-case";
import {
  demoAnswers,
  makeApplicationRepository,
  makeDemoTemplate,
  makeStudentRepository,
  makeTemplateRepository,
  startApplication,
  unwrap,
} from "../test-fixtures";
import {
  expectNoIdentifiableData,
  IDENTIFIABLE,
  makeIdentifiableStudent,
} from "../../../session-evolution/use-cases/test-fixtures";

describe("GenerateInsightUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeIdentifiableStudent(educatorId);
  const template = makeDemoTemplate();

  let draft: ScaleApplication;
  let completed: ScaleApplication;
  let applicationRepository: ReturnType<typeof makeApplicationRepository>;
  let aiService: AiClinicalService;
  let useCase: GenerateInsightUseCase;

  const aiParams = () => (aiService.scaleInsight as any).mock.calls[0][0];

  beforeEach(() => {
    draft = unwrap<ScaleApplication>(
      startApplication(template, student).saveAnswers(template, demoAnswers([2, 2, 1, 1]))
    );
    completed = unwrap<ScaleApplication>(
      unwrap<ScaleApplication>(
        startApplication(template, student).saveAnswers(
          template,
          demoAnswers([3, 3, 3, 3, 0, 0, 1, 0])
        )
      ).complete(template)
    );
    applicationRepository = makeApplicationRepository([draft, completed]);
    aiService = {
      nextSessionSuggestion: vi.fn(),
      scaleInsight: vi
        .fn()
        .mockResolvedValue({ text: "Vale observar a atenção em atividades longas." }),
      anamneseSummary: vi.fn(),
    };
    useCase = new GenerateInsightUseCase(
      applicationRepository,
      makeTemplateRepository([template]),
      makeStudentRepository([student]),
      aiService
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const generate = (applicationId: string, requester = educatorId) =>
    useCase.execute({ educatorId: requester, applicationId });

  it("saves a preliminary insight on a DRAFT and returns the whole application (IN-02)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-12T15:00:00.000Z"));

    const result = await generate(draft.id.value);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { application, template: usedTemplate, studentName } = result.value;
    expect(usedTemplate).toBe(template);
    expect(studentName).toBe(IDENTIFIABLE.name);
    expect(application.insight).toEqual({
      text: "Vale observar a atenção em atividades longas.",
      generatedAt: new Date("2026-11-12T15:00:00.000Z"),
      preliminary: true,
    });
    // Gerar insight não muda o status nem as respostas.
    expect(application.status).toBe(ApplicationStatus.DRAFT);
    expect(application.answers).toEqual(draft.answers);
    expect(applicationRepository.save).toHaveBeenCalledWith(application);
    expect(aiParams().preliminary).toBe(true);
  });

  it("saves a final insight on a COMPLETED application", async () => {
    const result = await generate(completed.id.value);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.application.insight?.preliminary).toBe(false);
    expect(result.value.application.status).toBe(ApplicationStatus.COMPLETED);
    expect(aiParams().preliminary).toBe(false);
  });

  it("replaces the previous insight when generated again", async () => {
    await generate(draft.id.value);
    (aiService.scaleInsight as any).mockResolvedValue({ text: "Novo insight." });

    const result = await generate(draft.id.value);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.application.insight?.text).toBe("Novo insight.");
    expect(applicationRepository.store.get(draft.id.value)?.insight?.text).toBe(
      "Novo insight."
    );
  });

  it("sends the scale name, bands and the server score, without item answers (IN-03)", async () => {
    await generate(completed.id.value);

    const params = aiParams();
    const score = template.computeScore(completed.answers);
    expect(params.student).toEqual({ age: 7, gender: Gender.Male });
    expect(params.scale.name).toBe(template.name);
    expect(params.scale.bands).toHaveLength(template.scoring.bands.length);
    expect(params.score).toMatchObject({
      partial: false,
      value: score.value,
      max: score.max,
      band: score.band,
    });
    expect(params.score.subscales.map((s: any) => [s.code, s.value, s.band?.severity])).toEqual(
      score.subscales.map((s) => [s.code, s.value, s.band?.severity])
    );

    const serialized = JSON.stringify(params);
    expect(serialized).not.toContain('"answers"');
    expect(serialized).not.toContain('"itemId"');
    expect(serialized).not.toContain("demo-1");
    expect(serialized).not.toContain("Item fictício");
  });

  it("does not send identifiable data of the student to the AI", async () => {
    await generate(draft.id.value);

    expectNoIdentifiableData(aiParams());
  });

  it("returns AI_GENERATION_FAILED when the service throws, without saving", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    (aiService.scaleInsight as any).mockRejectedValue(
      Object.assign(new Error("503 overloaded"), { status: 503 })
    );

    const result = await generate(draft.id.value);

    expect(result).toEqual({ ok: false, error: "AI_GENERATION_FAILED" });
    expect(applicationRepository.save).not.toHaveBeenCalled();
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("overloaded");
    consoleError.mockRestore();
  });

  it("returns AI_INVALID_OUTPUT for AiInvalidOutputError or an empty text", async () => {
    (aiService.scaleInsight as any).mockRejectedValueOnce(new AiInvalidOutputError());
    expect(await generate(draft.id.value)).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });

    (aiService.scaleInsight as any).mockResolvedValueOnce({ text: "  " });
    expect(await generate(draft.id.value)).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });

    expect(applicationRepository.save).not.toHaveBeenCalled();
  });

  it("truncates the insight to 800 characters", async () => {
    (aiService.scaleInsight as any).mockResolvedValue({ text: "i".repeat(1200) });

    const result = await generate(draft.id.value);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.application.insight?.text).toHaveLength(800);
  });

  it("returns UNAUTHORIZED for an application of a student of another educator", async () => {
    const result = await generate(draft.id.value, Uuid.random());

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(aiService.scaleInsight).not.toHaveBeenCalled();
  });

  it("returns APPLICATION_NOT_FOUND for an unknown or invalid id", async () => {
    expect(await generate(Uuid.random().value)).toEqual({
      ok: false,
      error: "APPLICATION_NOT_FOUND",
    });
    expect(await generate("nao-e-uuid")).toEqual({
      ok: false,
      error: "APPLICATION_NOT_FOUND",
    });
  });
});
