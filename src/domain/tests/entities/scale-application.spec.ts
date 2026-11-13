import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  ApplicationStatus,
  ScaleApplication,
} from "../../entities/scale-application";
import { DEMO_ITEM_IDS, demoAnswers, makeDemoTemplate } from "./scale-fixtures";

const unwrap = <T>(result: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!result.ok) throw new Error(`unexpected ${JSON.stringify(result.error)}`);
  return result.value as T;
};

const studentId = Uuid.random();
const educatorId = Uuid.random();
const template = makeDemoTemplate();

const start = () =>
  unwrap<ScaleApplication>(ScaleApplication.start({ template, studentId, educatorId }));

describe("ScaleApplication.start", () => {
  it("should start a draft with the template version", () => {
    const appointmentId = Uuid.random();
    const application = unwrap<ScaleApplication>(
      ScaleApplication.start({ template, studentId, educatorId, appointmentId })
    );

    expect(application.status).toBe(ApplicationStatus.DRAFT);
    expect(application.templateId.value).toBe(template.id.value);
    expect(application.templateCode).toBe("DEMO-RASTREIO");
    expect(application.templateVersion).toBe(1);
    expect(application.templateName).toBe(template.name);
    expect(application.appointmentId?.value).toBe(appointmentId.value);
    expect(application.answers).toEqual([]);
    expect(application.completedAt).toBeUndefined();
    expect(application.insight).toBeUndefined();
    expect(application.canBeDeleted).toBe(true);
  });

  it("should not start an application of an inactive scale", () => {
    const inactive = makeDemoTemplate({ active: false });

    expect(ScaleApplication.start({ template: inactive, studentId, educatorId })).toEqual({
      ok: false,
      error: "SCALE_INACTIVE",
    });
  });
});

describe("ScaleApplication.saveAnswers", () => {
  it("should upsert answers by itemId without changing the original", () => {
    const application = start();
    const first = unwrap<ScaleApplication>(
      application.saveAnswers(template, demoAnswers([1, 2]))
    );
    const second = unwrap<ScaleApplication>(
      first.saveAnswers(template, [
        { itemId: "demo-2", value: 3 },
        { itemId: "demo-3", value: 0 },
      ])
    );

    expect(application.answers).toEqual([]);
    expect(first.answers).toEqual(demoAnswers([1, 2]));
    expect(second.answers).toEqual(demoAnswers([1, 3, 0]));
  });

  it("should return ITEM_NOT_IN_SCALE for an unknown item", () => {
    const result = start().saveAnswers(template, [
      { itemId: "demo-1", value: 1 },
      { itemId: "outro", value: 1 },
    ]);

    expect(result).toEqual({ ok: false, error: "ITEM_NOT_IN_SCALE" });
  });

  it("should return INVALID_ANSWER_VALUE for a value outside the options", () => {
    expect(start().saveAnswers(template, [{ itemId: "demo-1", value: 4 }])).toEqual({
      ok: false,
      error: "INVALID_ANSWER_VALUE",
    });
    expect(start().saveAnswers(template, [{ itemId: "demo-1", value: 1.5 }])).toEqual({
      ok: false,
      error: "INVALID_ANSWER_VALUE",
    });
  });

  it("should not accept answers after completion", () => {
    const completed = unwrap<ScaleApplication>(
      unwrap<ScaleApplication>(
        start().saveAnswers(template, demoAnswers([0, 0, 0, 0, 0, 0, 0, 0]))
      ).complete(template)
    );

    expect(completed.saveAnswers(template, [{ itemId: "demo-1", value: 1 }])).toEqual({
      ok: false,
      error: "APPLICATION_NOT_EDITABLE",
    });
  });
});

describe("ScaleApplication.complete", () => {
  it("should return SCALE_INCOMPLETE with the missing item ids", () => {
    const partial = unwrap<ScaleApplication>(
      start().saveAnswers(template, demoAnswers([1, 1, 1, 1, 1]))
    );

    expect(partial.complete(template)).toEqual({
      ok: false,
      error: { code: "SCALE_INCOMPLETE", missingItemIds: ["demo-6", "demo-7", "demo-8"] },
    });
  });

  it("should complete a full application and make it read-only", () => {
    const full = unwrap<ScaleApplication>(
      start().saveAnswers(template, demoAnswers([1, 1, 1, 1, 1, 1, 1, 1]))
    );

    const completed = unwrap<ScaleApplication>(full.complete(template));

    expect(full.status).toBe(ApplicationStatus.DRAFT);
    expect(completed.status).toBe(ApplicationStatus.COMPLETED);
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.answers.map((answer) => answer.itemId)).toEqual(DEMO_ITEM_IDS);
    expect(completed.canBeDeleted).toBe(false);
    expect(completed.complete(template)).toEqual({
      ok: false,
      error: "APPLICATION_NOT_EDITABLE",
    });
  });
});
