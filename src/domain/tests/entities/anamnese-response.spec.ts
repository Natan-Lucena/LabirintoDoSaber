import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponse } from "../../entities/anamnese-response";
import { AnamneseQuestionType } from "../../entities/anamnese-template";

const makeResponse = (updatedAt?: Date) =>
  AnamneseResponse.fromPersistence({
    id: Uuid.random(),
    templateId: Uuid.random(),
    educatorId: Uuid.random(),
    studentId: Uuid.random(),
    answers: [
      { questionId: "q1", questionType: AnamneseQuestionType.Descriptive, textValue: "x" },
    ],
    answeredAt: new Date("2026-11-01T12:00:00.000Z"),
    updatedAt,
  });

describe("AnamneseResponse summary", () => {
  const generatedAt = new Date("2026-11-10T12:00:00.000Z");

  it("is not outdated without a summary", () => {
    expect(makeResponse(new Date("2026-11-11T12:00:00.000Z")).summaryOutdated).toBe(false);
  });

  it("is not outdated when the response was never edited or was edited before", () => {
    expect(makeResponse().withSummary({ text: "s", generatedAt }).summaryOutdated).toBe(false);
    expect(
      makeResponse(new Date("2026-11-09T12:00:00.000Z")).withSummary({ text: "s", generatedAt })
        .summaryOutdated
    ).toBe(false);
  });

  it("is outdated when edited after the summary", () => {
    expect(
      makeResponse(new Date("2026-11-10T12:00:01.000Z")).withSummary({ text: "s", generatedAt })
        .summaryOutdated
    ).toBe(true);
  });

  it("keeps updatedAt and answers when the summary is set", () => {
    const response = makeResponse(new Date("2026-11-09T12:00:00.000Z"));
    const summarized = response.withSummary({ text: "s", generatedAt });

    expect(summarized).not.toBe(response);
    expect(summarized.updatedAt).toEqual(response.updatedAt);
    expect(summarized.answers).toEqual(response.answers);
    expect(response.summary).toBeUndefined();
  });
});
