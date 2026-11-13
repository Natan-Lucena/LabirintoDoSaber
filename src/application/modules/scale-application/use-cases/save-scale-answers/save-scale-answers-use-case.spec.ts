import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ScaleApplication } from "../../../../../domain/entities/scale-application";
import { SaveScaleAnswersUseCase } from "./save-scale-answers-use-case";
import {
  demoAnswers,
  makeApplicationRepository,
  makeDemoTemplate,
  makeStudent,
  makeStudentRepository,
  makeTemplateRepository,
  startApplication,
  unwrap,
} from "../test-fixtures";

describe("SaveScaleAnswersUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);
  const template = makeDemoTemplate();

  let draft: ScaleApplication;
  let applicationRepository: ReturnType<typeof makeApplicationRepository>;
  let useCase: SaveScaleAnswersUseCase;

  beforeEach(() => {
    draft = startApplication(template, student);
    applicationRepository = makeApplicationRepository([draft]);
    useCase = new SaveScaleAnswersUseCase(
      applicationRepository,
      makeTemplateRepository([template]),
      makeStudentRepository([student])
    );
  });

  const save = (answers: { itemId: string; value: number }[], applicationId = draft.id.value) =>
    useCase.execute({ educatorId, applicationId, answers });

  it("should save half of the answers and score them as partial (BE-AV-02)", async () => {
    const result = await save(demoAnswers([3, 3, 3, 3]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { application } = result.value;
    expect(application.answers).toEqual(demoAnswers([3, 3, 3, 3]));
    expect(applicationRepository.save).toHaveBeenCalledWith(application);
    const score = template.computeScore(application.answers);
    expect(score).toMatchObject({ partial: true, answered: 4, total: 8, value: 12 });
    expect(score.band?.severity).toBe("MODERATE");
  });

  it("should upsert answers by itemId across calls", async () => {
    await save(demoAnswers([1, 1]));
    const result = await save([{ itemId: "demo-2", value: 3 }]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.application.answers).toEqual(demoAnswers([1, 3]));
  });

  it("should return ITEM_NOT_IN_SCALE and save nothing", async () => {
    const result = await save([{ itemId: "outro", value: 1 }]);

    expect(result).toEqual({ ok: false, error: "ITEM_NOT_IN_SCALE" });
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });

  it("should return INVALID_ANSWER_VALUE and save nothing", async () => {
    const result = await save([{ itemId: "demo-1", value: 7 }]);

    expect(result).toEqual({ ok: false, error: "INVALID_ANSWER_VALUE" });
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });

  it("should return APPLICATION_NOT_EDITABLE after completion", async () => {
    const full = unwrap<ScaleApplication>(
      draft.saveAnswers(template, demoAnswers([1, 1, 1, 1, 1, 1, 1, 1]))
    );
    const completed = unwrap<ScaleApplication>(full.complete(template));
    applicationRepository.store.set(completed.id.value, completed);

    expect(await save([{ itemId: "demo-1", value: 0 }])).toEqual({
      ok: false,
      error: "APPLICATION_NOT_EDITABLE",
    });
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });

  it("should return UNAUTHORIZED for another educator", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      applicationId: draft.id.value,
      answers: demoAnswers([1]),
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return APPLICATION_NOT_FOUND for a missing application or an invalid id", async () => {
    expect(await save(demoAnswers([1]), "abc")).toEqual({
      ok: false,
      error: "APPLICATION_NOT_FOUND",
    });
    expect(await save(demoAnswers([1]), Uuid.random().value)).toEqual({
      ok: false,
      error: "APPLICATION_NOT_FOUND",
    });
  });
});
