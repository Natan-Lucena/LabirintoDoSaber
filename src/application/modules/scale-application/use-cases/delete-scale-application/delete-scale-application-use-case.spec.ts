import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ScaleApplication } from "../../../../../domain/entities/scale-application";
import { DeleteScaleApplicationUseCase } from "./delete-scale-application-use-case";
import {
  demoAnswers,
  makeApplicationRepository,
  makeDemoTemplate,
  makeStudent,
  makeStudentRepository,
  startApplication,
  unwrap,
} from "../test-fixtures";

describe("DeleteScaleApplicationUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);
  const template = makeDemoTemplate();

  let draft: ScaleApplication;
  let applicationRepository: ReturnType<typeof makeApplicationRepository>;
  let useCase: DeleteScaleApplicationUseCase;

  beforeEach(() => {
    draft = startApplication(template, student);
    applicationRepository = makeApplicationRepository([draft]);
    useCase = new DeleteScaleApplicationUseCase(
      applicationRepository,
      makeStudentRepository([student])
    );
  });

  it("should delete a draft", async () => {
    const result = await useCase.execute({ educatorId, applicationId: draft.id.value });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(applicationRepository.delete).toHaveBeenCalledWith(draft.id);
  });

  it("should not delete a completed application (AV-08)", async () => {
    const completed = unwrap<ScaleApplication>(
      unwrap<ScaleApplication>(
        draft.saveAnswers(template, demoAnswers([0, 0, 0, 0, 0, 0, 0, 0]))
      ).complete(template)
    );
    applicationRepository.store.set(completed.id.value, completed);

    const result = await useCase.execute({ educatorId, applicationId: draft.id.value });

    expect(result).toEqual({ ok: false, error: "APPLICATION_NOT_EDITABLE" });
    expect(applicationRepository.delete).not.toHaveBeenCalled();
  });

  it("should return UNAUTHORIZED for another educator", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      applicationId: draft.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(applicationRepository.delete).not.toHaveBeenCalled();
  });

  it("should return APPLICATION_NOT_FOUND for a missing application or an invalid id", async () => {
    expect(await useCase.execute({ educatorId, applicationId: "x" })).toEqual({
      ok: false,
      error: "APPLICATION_NOT_FOUND",
    });
    expect(
      await useCase.execute({ educatorId, applicationId: Uuid.random().value })
    ).toEqual({ ok: false, error: "APPLICATION_NOT_FOUND" });
  });
});
