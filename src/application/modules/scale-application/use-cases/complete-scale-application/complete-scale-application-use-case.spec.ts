import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  ApplicationStatus,
  ScaleApplication,
} from "../../../../../domain/entities/scale-application";
import { CompleteScaleApplicationUseCase } from "./complete-scale-application-use-case";
import { SaveScaleAnswersUseCase } from "../save-scale-answers/save-scale-answers-use-case";
import { DeleteScaleApplicationUseCase } from "../delete-scale-application/delete-scale-application-use-case";
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

describe("CompleteScaleApplicationUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);
  const template = makeDemoTemplate();

  let draft: ScaleApplication;
  let applicationRepository: ReturnType<typeof makeApplicationRepository>;
  let useCase: CompleteScaleApplicationUseCase;
  let saveAnswers: SaveScaleAnswersUseCase;
  let deleteApplication: DeleteScaleApplicationUseCase;

  beforeEach(() => {
    draft = startApplication(template, student);
    applicationRepository = makeApplicationRepository([draft]);
    const templateRepository = makeTemplateRepository([template]);
    const studentRepository = makeStudentRepository([student]);
    useCase = new CompleteScaleApplicationUseCase(
      applicationRepository,
      templateRepository,
      studentRepository
    );
    saveAnswers = new SaveScaleAnswersUseCase(
      applicationRepository,
      templateRepository,
      studentRepository
    );
    deleteApplication = new DeleteScaleApplicationUseCase(
      applicationRepository,
      studentRepository
    );
  });

  const complete = (applicationId = draft.id.value) =>
    useCase.execute({ educatorId, applicationId });

  it("should return SCALE_INCOMPLETE with the missing item ids (BE-AV-04)", async () => {
    applicationRepository.store.set(
      draft.id.value,
      unwrap<ScaleApplication>(draft.saveAnswers(template, demoAnswers([1, 1, 1, 1, 1, 1])))
    );

    const result = await complete();

    expect(result).toEqual({
      ok: false,
      error: { code: "SCALE_INCOMPLETE", missingItemIds: ["demo-7", "demo-8"] },
    });
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });

  it("should complete and leave the application read-only (BE-AV-04)", async () => {
    await saveAnswers.execute({
      educatorId,
      applicationId: draft.id.value,
      answers: demoAnswers([2, 2, 1, 1, 2, 1, 1, 2]),
    });

    const result = await complete();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.application.status).toBe(ApplicationStatus.COMPLETED);
    expect(result.value.application.completedAt).toBeInstanceOf(Date);
    expect(applicationRepository.save).toHaveBeenLastCalledWith(result.value.application);

    expect(
      await saveAnswers.execute({
        educatorId,
        applicationId: draft.id.value,
        answers: demoAnswers([0]),
      })
    ).toEqual({ ok: false, error: "APPLICATION_NOT_EDITABLE" });
    expect(await complete()).toEqual({ ok: false, error: "APPLICATION_NOT_EDITABLE" });
    expect(
      await deleteApplication.execute({ educatorId, applicationId: draft.id.value })
    ).toEqual({ ok: false, error: "APPLICATION_NOT_EDITABLE" });
    expect(applicationRepository.delete).not.toHaveBeenCalled();
  });

  it("should return UNAUTHORIZED for another educator", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      applicationId: draft.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return APPLICATION_NOT_FOUND for an invalid id", async () => {
    expect(await complete("123")).toEqual({ ok: false, error: "APPLICATION_NOT_FOUND" });
  });
});
